import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Send, Forward } from "lucide-react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

/**
 * ForwardModal
 * Props:
 *   message   – the message object being forwarded
 *   onClose   – close without forwarding
 *   onDone    – called after successful forward; receives array of sent messages
 */
export default function ForwardModal({ message, onClose, onDone }) {
  const { user } = useAuth();

  const [chats,      setChats]      = useState([]);
  const [selected,   setSelected]   = useState(new Set()); // Set of chatIds
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [error,      setError]      = useState("");

  const searchRef = useRef(null);

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Auto-focus search
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Fetch all conversations
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/chat");
        setChats(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (chatId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(chatId) ? next.delete(chatId) : next.add(chatId);
      return next;
    });
  };

  const handleForward = async () => {
    if (selected.size === 0) return;
    setSending(true);
    setError("");
    try {
      const res = await API.post("/messages/forward", {
        messageId: message._id,
        chatIds:   [...selected],
      });
      onDone?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Forward failed. Try again.");
    } finally {
      setSending(false);
    }
  };

  // Preview of what is being forwarded
  const msgPreview = () => {
    if (message.poll)    return "📊 Poll";
    if (message.image)   return "📷 Photo";
    if (message.voice)   return "🎤 Voice note";
    if (message.fileUrl) return `📎 ${message.fileName || "File"}`;
    if (message.text)    return message.text.length > 60 ? message.text.slice(0, 60) + "…" : message.text;
    return "Message";
  };

  // Filter chats by search
  const filtered = chats.filter((c) => {
    const name = c.isGroup
      ? c.groupName
      : c.participants.find((p) => p._id !== user._id)?.name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getName = (chat) => {
    if (chat.isGroup) return chat.groupName;
    return chat.participants.find((p) => p._id !== user._id)?.name || "Unknown";
  };

  const getAvatar = (chat) => {
    if (chat.isGroup) return null;
    return chat.participants.find((p) => p._id !== user._id)?.avatar || null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 60, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full sm:max-w-sm bg-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/25 flex items-center justify-center">
              <Forward size={15} className="text-purple-400" />
            </div>
            <h2 className="text-sm font-bold text-white">Forward to…</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Message preview */}
        <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center gap-2 flex-shrink-0">
          <div className="w-1 self-stretch rounded-full bg-purple-500 flex-shrink-0" />
          <p className="text-xs text-zinc-400 truncate italic">{msgPreview()}</p>
        </div>

        {/* Search */}
        <div className="px-4 py-2 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>
        </div>

        {/* Selected count */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden flex-shrink-0"
            >
              <p className="text-[11px] text-purple-400 font-semibold px-5 pb-1">
                {selected.size} selected
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-hide min-h-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-zinc-600 text-sm py-10">
              {search ? `No results for "${search}"` : "No conversations yet"}
            </p>
          ) : (
            filtered.map((chat) => {
              const isSelected = selected.has(chat._id);
              const name   = getName(chat);
              const avatar = getAvatar(chat);

              return (
                <button
                  key={chat._id}
                  onClick={() => toggle(chat._id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all ${
                    isSelected ? "bg-purple-600/15 border border-purple-500/25" : "hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {chat.isGroup ? (
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs">
                        {name?.slice(0, 2).toUpperCase()}
                      </div>
                    ) : avatar ? (
                      <img src={avatar} className="w-10 h-10 rounded-2xl object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-zinc-700 flex items-center justify-center text-white font-bold text-sm">
                        {name?.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Name + type */}
                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? "text-purple-300" : "text-zinc-200"}`}>
                      {name}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {chat.isGroup ? `Group · ${chat.participants?.length} members` : "Direct message"}
                    </p>
                  </div>

                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? "bg-purple-600 border-purple-600" : "border-zinc-600"
                  }`}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-red-400 text-xs text-center px-5 pb-1 flex-shrink-0"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Footer — Send button */}
        <div className="px-4 pb-5 pt-3 border-t border-white/[0.07] flex-shrink-0">
          <button
            onClick={handleForward}
            disabled={selected.size === 0 || sending}
            className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed
              text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/40
              flex items-center justify-center gap-2"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={16} />
                Forward{selected.size > 1 ? ` to ${selected.size} chats` : ""}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}