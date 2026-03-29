import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import socket from "../socket";

/**
 * Mount this ONCE at App.jsx level — it listens globally for incoming calls
 * and renders over everything.
 *
 * Props:
 *   onAccept(callData) — called when user picks up
 *   onReject()         — called when user declines
 */
export default function IncomingCallNotification({ onAccept, onReject }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const audioRef       = useRef(null);
  const autoRejectRef  = useRef(null);

  // ── Ringtone — synthesised with Web Audio so no file dependency ──────────
  const startRingtone = () => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.connect(ctx.destination);

      let time = ctx.currentTime;
      const pattern = [0.4, 0.2, 0.4, 1.0]; // ring, pause, ring, pause

      const playTone = (start, dur) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, start);
        osc.frequency.setValueAtTime(1046, start + dur * 0.5);
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + dur);
      };

      for (let i = 0; i < 20; i++) {
        const [ring1, pause1, ring2, pause2] = pattern;
        playTone(time, ring1);
        time += ring1 + pause1;
        playTone(time, ring2);
        time += ring2 + pause2;
      }

      audioRef.current = ctx;
    } catch { /* audio not available */ }
  };

  const stopRingtone = () => {
    try { audioRef.current?.close(); } catch { /* ignore */ }
    audioRef.current = null;
  };

  useEffect(() => {
    const handleIncoming = (callData) => {
      setIncomingCall(callData);
      startRingtone();

      // Auto-reject after 30s (no answer)
      autoRejectRef.current = setTimeout(() => {
        handleReject(callData);
      }, 30000);
    };

    socket.on("incoming-call", handleIncoming);
    return () => socket.off("incoming-call", handleIncoming);
  }, []);

  const handleAccept = () => {
    clearTimeout(autoRejectRef.current);
    stopRingtone();
    socket.emit("call-answer", {
      roomId: incomingCall.roomId,
      to:     incomingCall.from,
      from:   incomingCall.to, // will be set by parent via useAuth
    });
    onAccept?.(incomingCall);
    setIncomingCall(null);
  };

  const handleReject = (call = incomingCall) => {
    clearTimeout(autoRejectRef.current);
    stopRingtone();
    if (call) {
      socket.emit("call-rejected", {
        roomId: call.roomId,
        to:     call.from,
        from:   call.to,
      });
    }
    onReject?.();
    setIncomingCall(null);
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -80 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4"
        >
          <div className="bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            {/* Animated ring bar */}
            <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 bg-[length:200%] animate-[shimmer_1.5s_linear_infinite]" />

            <div className="p-5">
              <div className="flex items-center gap-4">
                {/* Avatar with ring animation */}
                <div className="relative flex-shrink-0">
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="absolute inset-0 rounded-full bg-purple-500/30"
                  />
                  {incomingCall.callerAvatar ? (
                    <img
                      src={incomingCall.callerAvatar}
                      className="w-14 h-14 rounded-full object-cover relative z-10 ring-2 ring-purple-500/50"
                      alt=""
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl relative z-10">
                      {incomingCall.callerName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-400 font-medium mb-0.5">
                    Incoming {incomingCall.type === "video" ? "Video" : "Voice"} Call
                  </p>
                  <p className="text-white font-bold text-base truncate">
                    {incomingCall.callerName || "Unknown"}
                  </p>
                  {incomingCall.callType === "group" && (
                    <p className="text-xs text-zinc-500 mt-0.5">Group call</p>
                  )}
                </div>

                {/* Call type icon */}
                <div className="flex-shrink-0">
                  {incomingCall.type === "video" ? (
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleReject()}
                  className="flex-1 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                  </svg>
                  Decline
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAccept}
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Accept
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}