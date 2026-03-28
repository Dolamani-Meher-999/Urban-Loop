/**
 * useWebRTC — handles peer-to-peer WebRTC for 1-to-1 and group calls (mesh, max 10)
 *
 * Architecture:
 *  - 1-to-1:  single RTCPeerConnection, caller creates offer
 *  - Group:   full mesh — every participant connects to every other participant
 *             each pair negotiates independently
 *
 * Adaptive bitrate:
 *  - Uses RTCRtpSender.setParameters() to lower video bitrate when
 *    connection quality degrades (detected via getStats())
 */

import { useEffect, useRef, useState, useCallback } from "react";
import socket from "../socket";
import API from "../services/api";

const VIDEO_CONSTRAINTS = {
  high:   { width: 1280, height: 720,  frameRate: 30 },
  medium: { width: 640,  height: 480,  frameRate: 24 },
  low:    { width: 320,  height: 240,  frameRate: 15 },
};

const VIDEO_BITRATES = { high: 1200000, medium: 500000, low: 150000 };

export function useWebRTC({ roomId, userId, participantIds, type, isInitiator }) {
  const [localStream,   setLocalStream]   = useState(null);
  const [remoteStreams,  setRemoteStreams]  = useState({}); // socketId → MediaStream
  const [isMuted,       setIsMuted]       = useState(false);
  const [isCamOff,      setIsCamOff]      = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [qualityLevel,  setQualityLevel]  = useState("high");
  const [error,         setError]         = useState(null);

  // socketId → RTCPeerConnection
  const peersRef       = useRef({});
  const localStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const iceServersRef  = useRef([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ]);
  const qualityTimerRef = useRef(null);

  // ── Get ICE servers ──────────────────────────────────────────────────────
  useEffect(() => {
    API.get("/calls/ice-servers")
      .then((r) => { iceServersRef.current = r.data.iceServers; })
      .catch(() => {}); // fall back to Google STUN
  }, []);

  // ── Create a peer connection ─────────────────────────────────────────────
  const createPeer = useCallback((targetSocketId, initiating) => {
    if (peersRef.current[targetSocketId]) return peersRef.current[targetSocketId];

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceTransportPolicy: "all",
    });

    peersRef.current[targetSocketId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("webrtc-ice-room", { roomId, candidate, targetSocketId });
      }
    };

    // Remote stream
    pc.ontrack = ({ streams: [stream] }) => {
      setRemoteStreams((prev) => ({ ...prev, [targetSocketId]: stream }));
    };

    // Connection state monitoring for adaptive quality
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        startQualityMonitor(pc, targetSocketId);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetSocketId];
          return next;
        });
        stopQualityMonitor();
      }
    };

    if (initiating) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer-room", { roomId, offer, targetSocketId });
        } catch (e) { console.error("Offer error:", e); }
      };
    }

    return pc;
  }, [roomId]);

  // ── Adaptive quality monitoring ──────────────────────────────────────────
  const startQualityMonitor = useCallback((pc, targetSocketId) => {
    if (qualityTimerRef.current) return;
    qualityTimerRef.current = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let totalLost = 0, totalSent = 0, rtt = 0;

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            totalLost += report.packetsLost || 0;
            totalSent += report.packetsSent || 0;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rtt = report.currentRoundTripTime || 0;
          }
        });

        const lossRate = totalSent > 0 ? totalLost / totalSent : 0;
        let newQuality = "high";
        if (rtt > 0.3 || lossRate > 0.1)       newQuality = "medium";
        if (rtt > 0.6 || lossRate > 0.2)       newQuality = "low";

        setQualityLevel((prev) => {
          if (prev !== newQuality) applyQuality(pc, newQuality);
          return newQuality;
        });
      } catch { /* ignore */ }
    }, 5000);
  }, []);

  const stopQualityMonitor = useCallback(() => {
    if (qualityTimerRef.current) {
      clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    }
  }, []);

  const applyQuality = (pc, level) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind !== "video") return;
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) return;
      params.encodings[0].maxBitrate = VIDEO_BITRATES[level];
      sender.setParameters(params).catch(() => {});
    });
  };

  // ── Start local media ────────────────────────────────────────────────────
  const startLocalMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: true,
        video: type === "video" ? VIDEO_CONSTRAINTS.high : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      setError("Could not access camera/microphone: " + err.message);
      throw err;
    }
  }, [type]);

  // ── Socket event handlers ────────────────────────────────────────────────
  useEffect(() => {
    const handlePeerJoined = async ({ socketId }) => {
      // A new peer joined — we initiate the offer to them
      const pc = createPeer(socketId, true);
      // onnegotiationneeded will fire and create offer
    };

    const handleOffer = async ({ offer, from }) => {
      const pc = createPeer(from, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer-room", { roomId, answer, targetSocketId: from });
      } catch (e) { console.error("Answer error:", e); }
    };

    const handleAnswer = async ({ answer, from }) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      try {
        if (pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (e) { console.error("Set answer error:", e); }
    };

    const handleIce = async ({ candidate, from }) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore race conditions */ }
    };

    const handlePeerLeft = ({ socketId }) => {
      const pc = peersRef.current[socketId];
      if (pc) { pc.close(); delete peersRef.current[socketId]; }
      setRemoteStreams((prev) => {
        const next = { ...prev }; delete next[socketId]; return next;
      });
    };

    socket.on("peer-joined",           handlePeerJoined);
    socket.on("webrtc-offer",          handleOffer);
    socket.on("webrtc-answer",         handleAnswer);
    socket.on("webrtc-ice-candidate",  handleIce);
    socket.on("peer-left",             handlePeerLeft);

    return () => {
      socket.off("peer-joined",          handlePeerJoined);
      socket.off("webrtc-offer",         handleOffer);
      socket.off("webrtc-answer",        handleAnswer);
      socket.off("webrtc-ice-candidate", handleIce);
      socket.off("peer-left",            handlePeerLeft);
    };
  }, [roomId, createPeer]);

  // ── Initialise call ──────────────────────────────────────────────────────
  const joinCall = useCallback(async () => {
    await startLocalMedia();
    socket.emit("join-call-room", roomId);
  }, [roomId, startLocalMedia]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((v) => !v);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCamOff((v) => !v);
  }, []);

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    const currentFacing = currentTrack?.getSettings()?.facingMode || "user";
    const newFacing = currentFacing === "user" ? "environment" : "user";

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO_CONSTRAINTS.high, facingMode: newFacing },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in all peer connections
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(newVideoTrack);
      });

      // Replace in local stream
      localStreamRef.current.removeTrack(currentTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      currentTrack.stop();
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (e) { console.error("Switch camera error:", e); }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", frameRate: 30 },
        audio: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => stopScreenShare();
      setIsSharingScreen(true);
    } catch (e) { console.error("Screen share error:", e); }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!screenTrackRef.current) return;
    screenTrackRef.current.stop();

    // Revert to camera
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS.high,
        audio: false,
      });
      const camTrack = camStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(camTrack);
      });
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      localStreamRef.current = new MediaStream([
        ...localStreamRef.current.getAudioTracks(),
        camTrack,
      ]);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch { /* ignore */ }

    screenTrackRef.current = null;
    setIsSharingScreen(false);
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    stopQualityMonitor();
    socket.emit("leave-call-room", roomId);
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
  }, [roomId, stopQualityMonitor]);

  return {
    localStream,
    remoteStreams,
    isMuted,
    isCamOff,
    isSharingScreen,
    qualityLevel,
    error,
    joinCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    startScreenShare,
    stopScreenShare,
  };
}