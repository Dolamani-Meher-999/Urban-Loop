import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWebRTC } from "../hooks/useWebRTC";
import API from "../services/api";
import socket from "../socket";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDuration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
};

// ── VideoTile ─────────────────────────────────────────────────────────────────
function VideoTile({ stream, label, isLocal, isMuted, isCamOff, avatar, isSmall }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center
      ${isSmall ? "w-28 h-20 md:w-36 md:h-28" : "w-full h-full"}`}>
      {stream && !isCamOff ? (
        <video
          ref={videoRef}
          autoPlay playsInline muted={isLocal || isMuted}
          className={`w-full h-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          {avatar ? (
            <img src={avatar} className="w-14 h-14 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-2xl font-bold text-white">
              {label?.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Name + mute badge */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <span className="text-white text-[10px] font-semibold truncate">{label}</span>
        {isMuted && (
          <span className="bg-red-500 rounded-full p-0.5">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </span>
        )}
      </div>

      {/* Quality badge for local */}
      {isLocal && (
        <div className="absolute top-1.5 right-1.5">
          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-black/50 text-zinc-300">
            {isSmall ? "You" : "You"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── ControlButton ─────────────────────────────────────────────────────────────
function ControlButton({ onClick, active, danger, disabled, icon, label, className = "" }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 group disabled:opacity-40 ${className}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
        ${danger
          ? "bg-red-500 hover:bg-red-400 text-white"
          : active
            ? "bg-white text-zinc-900 hover:bg-zinc-100"
            : "bg-white/10 hover:bg-white/20 text-white border border-white/10"}`}>
        {icon}
      </div>
      <span className="text-[10px] text-zinc-400 font-medium">{label}</span>
    </motion.button>
  );
}

// ── AddParticipantModal ───────────────────────────────────────────────────────
function AddParticipantModal({ chatId, currentParticipantIds, onInvite, onClose }) {
  const [contacts, setContacts]   = useState([]);
  const [selected, setSelected]   = useState([]);
  const [loading,  setLoading]    = useState(true);

  useEffect(() => {
    API.get("/users")
      .then((r) => setContacts(r.data.filter((u) => !currentParticipantIds.includes(u._id))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white">Add Participant</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="max-h-72 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-center text-zinc-600 text-sm py-6">No contacts available</p>
          ) : contacts.map((u) => (
            <button key={u._id} onClick={() => toggle(u._id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                selected.includes(u._id) ? "bg-purple-600/20 border border-purple-500/30" : "hover:bg-white/5 border border-transparent"
              }`}>
              <img src={u.avatar || "/avatar.png"} className="w-9 h-9 rounded-full object-cover" alt="" />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">{u.name}</p>
                <p className="text-xs text-zinc-500">@{u.username}</p>
              </div>
              {selected.includes(u._id) && (
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-white/5">
          <button
            onClick={() => { onInvite(selected); onClose(); }}
            disabled={selected.length === 0}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white text-sm font-bold transition-all"
          >
            Invite {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── CallRoom (main) ───────────────────────────────────────────────────────────
export default function CallRoom({
  roomId,
  type,           // "voice" | "video"
  callType,       // "direct" | "group"
  chatId,
  participants,   // [{ _id, name, avatar }] everyone in call
  userId,
  isInitiator,
  onEnd,
}) {
  const [duration,       setDuration]       = useState(0);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [callParticipants, setCallParticipants] = useState(participants || []);

  const {
    localStream, remoteStreams,
    isMuted, isCamOff, isSharingScreen, qualityLevel, error,
    joinCall, endCall,
    toggleMute, toggleCamera, switchCamera,
    startScreenShare, stopScreenShare,
  } = useWebRTC({
    roomId,
    userId,
    participantIds: callParticipants.map((p) => p._id),
    type,
    isInitiator,
  });

  // ── Duration timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Join call on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    joinCall();
    API.post("/calls/log", {
      roomId, type, callType, chatId,
      participantIds: callParticipants.map((p) => p._id),
    }).catch(() => {});

    return () => {
      API.patch(`/calls/log/${roomId}/end`).catch(() => {});
    };
  }, []);

  // ── Handle remote end ──────────────────────────────────────────────────────
  useEffect(() => {
    const onCallEnded = () => handleEnd(false);
    socket.on("call-ended", onCallEnded);
    return () => socket.off("call-ended", onCallEnded);
  }, []);

  // ── Invite new participants ────────────────────────────────────────────────
  const handleInvite = useCallback((userIds) => {
    const MAX = 10;
    const canAdd = MAX - callParticipants.length;
    const toInvite = userIds.slice(0, canAdd);

    toInvite.forEach((uid) => {
      socket.emit("call-invite", {
        roomId, type, callType, chatId,
        to: [uid],
        from: userId,
        callerName: "Conference Call",
        callerAvatar: null,
      });
    });
  }, [roomId, type, callType, chatId, userId, callParticipants]);

  const handleEnd = useCallback((initiated = true) => {
    if (initiated) {
      socket.emit("call-ended", { roomId, chatId });
      API.patch(`/calls/log/${roomId}/end`).catch(() => {});
    }
    endCall();
    onEnd?.();
  }, [roomId, chatId, endCall, onEnd]);

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const remoteEntries  = Object.entries(remoteStreams);
  const totalRemote    = remoteEntries.length;
  const isGroupCall    = totalRemote > 1;

  const gridClass = () => {
    if (totalRemote === 0) return "grid-cols-1";
    if (totalRemote === 1) return "grid-cols-1 md:grid-cols-2";
    if (totalRemote <= 3)  return "grid-cols-2";
    if (totalRemote <= 8)  return "grid-cols-2 md:grid-cols-3";
    return "grid-cols-3 md:grid-cols-4";
  };

  // ── Voice call layout vs video ─────────────────────────────────────────────
  const isVoice = type === "voice";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex flex-col bg-zinc-950 text-white"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${qualityLevel === "high" ? "bg-emerald-400" : qualityLevel === "medium" ? "bg-amber-400" : "bg-red-400"} animate-pulse`} />
          <span className="text-xs text-zinc-400 font-mono">{fmtDuration(duration)}</span>
          {qualityLevel !== "high" && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              qualityLevel === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
            }`}>
              {qualityLevel === "medium" ? "Medium quality" : "Low quality — poor connection"}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">
          {type === "video" ? "Video Call" : "Voice Call"}
        </div>
        <div className="text-xs text-zinc-500">
          {callParticipants.length} / 10
        </div>
      </div>

      {/* ── Video / Voice area ── */}
      <div className="flex-1 relative overflow-hidden px-3 pb-3">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
            <button onClick={() => handleEnd(true)}
              className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-bold">
              Leave Call
            </button>
          </div>
        ) : isVoice ? (
          /* Voice call — avatar grid */
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="flex flex-wrap items-center justify-center gap-6">
              {/* Local */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center text-3xl font-bold ring-4 ring-purple-500/40">
                    {/* Would use user avatar here */}
                    Me
                  </div>
                  {isMuted && (
                    <span className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-400">You</span>
              </div>

              {/* Remote participants */}
              {callParticipants.filter((p) => p._id !== userId).map((p) => (
                <div key={p._id} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <img src={p.avatar || "/avatar.png"}
                      className="w-20 h-20 rounded-full object-cover ring-4 ring-white/10" alt="" />
                  </div>
                  <span className="text-xs text-zinc-400">{p.name}</span>
                </div>
              ))}
            </div>

            {/* Audio elements for remote streams */}
            {remoteEntries.map(([sid, stream]) => (
              <audio key={sid} autoPlay ref={(el) => { if (el) el.srcObject = stream; }} />
            ))}
          </div>
        ) : (
          /* Video call layout */
          <div className="h-full relative">
            {/* Main grid */}
            {totalRemote === 0 ? (
              /* Waiting for others */
              <div className="h-full flex items-center justify-center">
                <VideoTile stream={localStream} label="You" isLocal isMuted={isMuted} isCamOff={isCamOff} />
              </div>
            ) : totalRemote === 1 ? (
              /* 1-to-1 — remote fills, local is pip */
              <div className="h-full relative">
                <VideoTile
                  stream={remoteEntries[0][1]}
                  label={callParticipants.find((p) => p._id !== userId)?.name || "Participant"}
                  isLocal={false} isMuted={false}
                />
                {/* PiP */}
                <div className="absolute bottom-4 right-4 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <VideoTile stream={localStream} label="You" isLocal isMuted={isMuted} isCamOff={isCamOff} isSmall />
                </div>
              </div>
            ) : (
              /* Group grid */
              <div className={`grid ${gridClass()} gap-2 h-full`}>
                {/* Local tile */}
                <div className="min-h-[140px]">
                  <VideoTile stream={localStream} label="You" isLocal isMuted={isMuted} isCamOff={isCamOff} />
                </div>
                {remoteEntries.map(([sid, stream]) => {
                  const p = callParticipants.find((x) => x._id !== userId) || {};
                  return (
                    <div key={sid} className="min-h-[140px]">
                      <VideoTile stream={stream} label={p.name || "Participant"} isLocal={false} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className="flex-shrink-0 px-6 pb-8 pt-4">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl px-6 py-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <ControlButton
              onClick={toggleMute} active={isMuted}
              label={isMuted ? "Unmute" : "Mute"}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMuted
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  }
                </svg>
              }
            />

            {type === "video" && (
              <ControlButton
                onClick={toggleCamera} active={isCamOff}
                label={isCamOff ? "Show Cam" : "Hide Cam"}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isCamOff
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z M3 3l18 18" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    }
                  </svg>
                }
              />
            )}

            {type === "video" && (
              <ControlButton
                onClick={switchCamera}
                label="Flip"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              />
            )}

            {type === "video" && (
              <ControlButton
                onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                active={isSharingScreen}
                label={isSharingScreen ? "Stop Share" : "Share Screen"}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
            )}

            {/* Add participant — only if < 10 */}
            {callParticipants.length < 10 && (
              <ControlButton
                onClick={() => setShowAddModal(true)}
                label="Add"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                }
              />
            )}

            {/* End call */}
            <ControlButton
              onClick={() => handleEnd(true)} danger
              label="End Call"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              }
            />
          </div>
        </div>
      </div>

      {/* Add participant modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddParticipantModal
            chatId={chatId}
            currentParticipantIds={callParticipants.map((p) => p._id)}
            onInvite={handleInvite}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}