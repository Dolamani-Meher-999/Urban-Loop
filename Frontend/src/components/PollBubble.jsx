import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * PollBubble
 * Props:
 *   poll         — the poll subdoc { question, options, allowMultiple, isClosed }
 *   isMine       — true if the current user sent this message
 *   onVote(idxs) — callback when user picks option(s); receives number[]
 */
export default function PollBubble({ poll, isMine, onVote }) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  if (!poll) return null;

  const uid = user?._id?.toString();
  const totalVotes = poll.options.reduce((n, o) => n + (o.votes?.length || 0), 0);

  // Which indexes has the current user voted on?
  const myVotes = poll.options
    .map((o, i) => ({ i, voted: (o.votes || []).some((v) => (v?._id || v)?.toString() === uid) }))
    .filter((x) => x.voted)
    .map((x) => x.i);

  const hasVoted = myVotes.length > 0;

  const handleSelect = async (idx) => {
    if (poll.isClosed || pending) return;

    let next;
    if (poll.allowMultiple) {
      // toggle this option in/out of selection
      next = myVotes.includes(idx)
        ? myVotes.filter((i) => i !== idx)
        : [...myVotes, idx];
      if (next.length === 0) return; // must keep at least one selection
    } else {
      if (myVotes[0] === idx) return; // already voted here
      next = [idx];
    }

    setPending(true);
    try { await onVote(next); }
    finally { setPending(false); }
  };

  const bubbleBg  = isMine ? "bg-purple-700/80" : "bg-zinc-900/80 border border-white/[0.07]";
  const labelCol  = isMine ? "text-purple-200"   : "text-zinc-400";
  const barBg     = isMine ? "bg-white/15"        : "bg-white/10";
  const barFill   = isMine ? "bg-white/50"        : "bg-purple-500/60";
  const optBorder = isMine ? "border-white/20"    : "border-white/10";
  const optHover  = isMine ? "hover:bg-white/10"  : "hover:bg-white/5";
  const optActive = isMine ? "bg-white/15 border-white/40" : "bg-purple-500/15 border-purple-500/40";

  return (
    <div className={`rounded-[20px] px-4 pt-4 pb-3 shadow-lg backdrop-blur-md ${bubbleBg}`}
      style={{ minWidth: 240, maxWidth: 320 }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} className={isMine ? "text-purple-300" : "text-purple-400"} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${labelCol}`}>Poll</span>
        {poll.isClosed && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500 font-semibold">
            <Lock size={10} /> Closed
          </span>
        )}
        {poll.allowMultiple && !poll.isClosed && (
          <span className={`ml-auto text-[10px] ${labelCol} opacity-70`}>Multiple choice</span>
        )}
      </div>

      {/* Question */}
      <p className={`text-sm font-bold leading-snug mb-3 ${isMine ? "text-white" : "text-zinc-100"}`}>
        {poll.question}
      </p>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const votes  = opt.votes?.length || 0;
          const pct    = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isMyVote = myVotes.includes(i);

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={poll.isClosed || pending}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all relative overflow-hidden
                ${isMyVote ? optActive : `${optBorder} ${optHover} bg-transparent`}
                disabled:cursor-default`}
            >
              {/* Progress bar fill */}
              {hasVoted && (
                <motion.div
                  className={`absolute inset-0 ${barBg} rounded-xl`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{ originX: 0 }}
                />
              )}

              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Checkbox / radio indicator */}
                  <span className={`w-4 h-4 rounded-${poll.allowMultiple ? "md" : "full"} border flex-shrink-0 flex items-center justify-center transition-all
                    ${isMyVote
                      ? isMine ? "bg-white border-white" : "bg-purple-500 border-purple-500"
                      : isMine ? "border-white/30" : "border-zinc-600"}`}>
                    {isMyVote && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                        <path d={poll.allowMultiple ? "M2 5l2.5 2.5L8 3" : ""} stroke={isMine ? "#7c3aed" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        {!poll.allowMultiple && <circle cx="5" cy="5" r="2" fill={isMine ? "#7c3aed" : "white"} />}
                      </svg>
                    )}
                  </span>
                  <span className={`text-xs font-medium truncate ${isMine ? "text-white" : "text-zinc-200"}`}>
                    {opt.text}
                  </span>
                </div>

                {hasVoted && (
                  <span className={`text-[11px] font-bold flex-shrink-0 ${isMine ? "text-purple-200" : "text-zinc-400"}`}>
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: total votes */}
      <div className={`mt-3 flex items-center justify-between text-[10px] ${labelCol} opacity-70`}>
        <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
        {pending && <div className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />}
      </div>
    </div>
  );
}