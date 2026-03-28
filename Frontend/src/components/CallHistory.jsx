import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

const fmtDuration = (s) => {
  if (!s || s === 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec}s`;
};

const fmtDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

function CallItem({ log, userId, onCallAgain }) {
  const isOutgoing  = log.initiator?._id === userId || log.initiator === userId;
  const myEntry     = log.participants?.find((p) =>
    (p.user?._id || p.user) === userId
  );
  const status      = myEntry?.status || log.status;
  const isMissed    = status === "missed" || status === "no-answer";
  const isRejected  = status === "rejected";

  // The other side: for direct calls
  const others = log.participants
    ?.filter((p) => (p.user?._id || p.user) !== userId)
    .map((p) => p.user)
    .filter(Boolean);

  const displayUser = others?.[0];
  const displayName = log.callType === "group"
    ? `Group call (${log.participants?.length} people)`
    : displayUser?.name || "Unknown";
  const displayAvatar = displayUser?.avatar;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/[0.03] transition-all group"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {displayAvatar ? (
          <img src={displayAvatar} className="w-12 h-12 rounded-2xl object-cover" alt="" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-white font-bold">
            {displayName?.charAt(0)?.toUpperCase()}
          </div>
        )}
        {/* Call type badge */}
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-zinc-950
          ${log.type === "video" ? "bg-blue-500" : "bg-purple-500"}`}>
          {log.type === "video" ? (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {/* Direction arrow */}
          <svg className={`w-3 h-3 flex-shrink-0 ${isMissed || isRejected ? "text-red-400" : isOutgoing ? "text-zinc-500" : "text-emerald-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isOutgoing
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            }
          </svg>
          <span className={`text-xs font-medium ${isMissed || isRejected ? "text-red-400" : "text-zinc-500"}`}>
            {isMissed ? "Missed" : isRejected ? "Rejected" : isOutgoing ? "Outgoing" : "Incoming"}
            {log.duration > 0 && ` · ${fmtDuration(log.duration)}`}
          </span>
        </div>
      </div>

      {/* Time + call again */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-[10px] text-zinc-600">{fmtDate(log.createdAt)}</span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onCallAgain(log)}
          className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 transition-all"
          title={`Call again (${log.type})`}
        >
          {log.type === "video" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function CallHistory({ onCallAgain }) {
  const { user } = useAuth();
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all"); // all | missed | video | voice

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/calls/history");
      setLogs(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    if (filter === "missed") {
      const my = log.participants?.find((p) => (p.user?._id || p.user) === user._id);
      return my?.status === "missed" || my?.status === "no-answer";
    }
    if (filter === "video")  return log.type === "video";
    if (filter === "voice")  return log.type === "voice";
    return true;
  });

  const FILTERS = [
    { id: "all",    label: "All" },
    { id: "missed", label: "Missed" },
    { id: "video",  label: "Video" },
    { id: "voice",  label: "Voice" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 flex-shrink-0 border-b border-white/[0.06]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === f.id
                ? "bg-purple-600 text-white"
                : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button onClick={fetchLogs} className="ml-auto p-1.5 rounded-xl text-zinc-600 hover:text-white hover:bg-white/5 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <p className="text-sm font-medium">No calls yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            <AnimatePresence>
              {filtered.map((log) => (
                <CallItem
                  key={log._id}
                  log={log}
                  userId={user._id}
                  onCallAgain={onCallAgain}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}