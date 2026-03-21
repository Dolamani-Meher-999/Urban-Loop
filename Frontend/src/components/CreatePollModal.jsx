import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, BarChart2 } from "lucide-react";

export default function CreatePollModal({ onClose, onSubmit, submitting }) {
  const [question,       setQuestion]       = useState("");
  const [options,        setOptions]        = useState(["", ""]);
  const [allowMultiple,  setAllowMultiple]  = useState(false);
  const [error,          setError]          = useState("");

  const questionRef = useRef(null);
  useEffect(() => { questionRef.current?.focus(); }, []);

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const updateOption = (i, val) =>
    setOptions((prev) => prev.map((o, idx) => idx === i ? val : o));

  const addOption = () => {
    if (options.length >= 12) return;
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (i) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!question.trim()) { setError("Please enter a question."); return; }
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (filled.length < 2) { setError("Add at least 2 options."); return; }
    if (new Set(filled).size !== filled.length) { setError("Options must be unique."); return; }
    onSubmit({ question: question.trim(), options: filled, allowMultiple });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1,    y: 0,  opacity: 1 }}
        exit={{    scale: 0.95, y: 16, opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/25 flex items-center justify-center">
              <BarChart2 size={16} className="text-purple-400" />
            </div>
            <h2 className="text-sm font-bold text-white">Create Poll</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">

            {/* Question */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                Question
              </label>
              <textarea
                ref={questionRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask something…"
                rows={2}
                maxLength={200}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
              />
            </div>

            {/* Options */}
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                Options ({options.length}/12)
              </label>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {options.map((opt, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0,  height: "auto" }}
                      exit={{    opacity: 0, y: -8, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2"
                    >
                      {/* Option number indicator */}
                      <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-500 flex-shrink-0">
                        {i + 1}
                      </span>
                      <input
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); addOption(); }
                        }}
                        placeholder={`Option ${i + 1}`}
                        maxLength={100}
                        className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        disabled={options.length <= 2}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-0 transition-all flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Add option */}
              {options.length < 12 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-2 flex items-center gap-2 text-xs text-zinc-500 hover:text-purple-400 transition-colors px-1 py-1"
                >
                  <Plus size={14} /> Add option
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
              <div>
                <p className="text-sm font-semibold text-zinc-300">Allow multiple answers</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Voters can pick more than one option</p>
              </div>
              <button
                type="button"
                onClick={() => setAllowMultiple((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${allowMultiple ? "bg-purple-600" : "bg-zinc-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${allowMultiple ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-red-400 text-xs px-1"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-white/[0.07] flex-shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40"
            >
              {submitting
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><BarChart2 size={16} /> Send Poll</>
              }
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}