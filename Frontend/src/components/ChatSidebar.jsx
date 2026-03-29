import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import socket from "../socket";
import CallHistory from "./CallHistory";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const lastMsgPreview = (chat, userId) => {
  const msg = chat.lastMessage;
  if (!msg) return "No messages yet";
  if (msg.deletedForEveryone) return "Message deleted";
  const mine = msg.sender === userId || msg.sender?._id === userId;
  const prefix = mine ? "You: " : "";
  if (msg.voice) return `${prefix}🎤 Voice Note`;
  if (msg.image) return `${prefix}📷 Photo`;
  if (msg.fileUrl) return `${prefix}📎 ${msg.fileName || "File"}`;
  return `${prefix}${msg.text || ""}`;
};

// ─── CreateGroupModal ─────────────────────────────────────────────────────────
function CreateGroupModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [step,        setStep]        = useState(1); // 1 = name, 2 = pick members
  const [groupName,   setGroupName]   = useState("");
  const [search,      setSearch]      = useState("");
  const [allUsers,    setAllUsers]    = useState([]);
  const [selected,    setSelected]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [creating,    setCreating]    = useState(false);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  // Fetch all users to pick from
  useEffect(() => {
    if (step !== 2) return;
    (async () => {
      setLoading(true);
      try {
        const res = await API.get("/users");
        setAllUsers(res.data.filter((u) => u._id !== user._id));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [step]);

  const toggleUser = (u) =>
    setSelected((prev) =>
      prev.some((s) => s._id === u._id) ? prev.filter((s) => s._id !== u._id) : [...prev, u]
    );

  const createGroup = async () => {
    if (!groupName.trim() || selected.length < 2) return;
    setCreating(true);
    try {
      const res = await API.post("/chat/group", {
        name: groupName.trim(),
        userIds: selected.map((u) => u._id),
      });
      onCreated(res.data);
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const filtered = allUsers.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-sm bg-zinc-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="font-bold text-white text-sm">
              {step === 1 ? "New Group" : "Add Members"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 1 ? (
          /* ── Step 1: Group name ── */
          <div className="flex flex-col gap-5 px-5 py-6">
            {/* Group avatar placeholder */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-900/40">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Group Name</label>
              <input
                ref={nameRef}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && groupName.trim() && setStep(2)}
                placeholder="Enter group name…"
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>
            <button
              onClick={() => groupName.trim() && setStep(2)}
              disabled={!groupName.trim()}
              className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold transition-all"
            >
              Next — Add Members
            </button>
          </div>
        ) : (
          /* ── Step 2: Pick members ── */
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 pt-4 pb-2 flex-shrink-0">
                {selected.map((u) => (
                  <button key={u._id} onClick={() => toggleUser(u)}
                    className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 rounded-full pl-1 pr-2.5 py-1 text-xs text-purple-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all">
                    <img src={u.avatar || "/avatar.png"} className="w-5 h-5 rounded-full object-cover" alt="" />
                    {u.name}
                    <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="px-5 pb-3 flex-shrink-0">
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people…"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5 scrollbar-hide min-h-0">
              {loading ? (
                <div className="flex justify-center pt-8">
                  <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 && search ? (
                <p className="text-center text-zinc-600 text-sm pt-8">No results for "{search}"</p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 pt-10 px-4 text-center">
                  <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-zinc-500 text-sm font-medium">No mutual friends yet</p>
                  <p className="text-zinc-600 text-xs leading-relaxed">
                    Only people who follow you back can be added to a group. Follow some people and ask them to follow back.
                  </p>
                </div>
              ) : filtered.map((u) => {
                const isSelected = selected.some((s) => s._id === u._id);
                return (
                  <button key={u._id} onClick={() => toggleUser(u)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${isSelected ? "bg-purple-600/15 border border-purple-500/20" : "hover:bg-white/[0.03] border border-transparent"}`}>
                    <div className="relative flex-shrink-0">
                      <img src={u.avatar || "/avatar.png"} className="w-10 h-10 rounded-2xl object-cover border border-white/10" alt="" />
                      {isSelected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-purple-600 border-2 border-zinc-950 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm font-semibold truncate ${isSelected ? "text-purple-300" : "text-zinc-300"}`}>{u.name}</p>
                      <p className="text-xs text-zinc-600 truncate">{u.email || u.username || ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Create button */}
            <div className="px-5 py-4 border-t border-white/5 flex-shrink-0">
              <button
                onClick={createGroup}
                disabled={selected.length < 2 || creating}
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Create Group {selected.length >= 2 ? `(${selected.length + 1})` : ""}
                  </>
                )}
              </button>
              {selected.length < 2 && (
                <p className="text-center text-zinc-600 text-xs mt-2">Add at least 2 members</p>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── ChatSidebar ──────────────────────────────────────────────────────────────
function ChatSidebar({ onSelectChat, selectedChatId, onChatDeleted, onCallAgain }) {
  const { user } = useAuth();
  const [activeTab,    setActiveTab]    = useState("chats"); // "chats" | "calls"
  const [chats,        setChats]        = useState([]);
  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [search,       setSearch]       = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewMenu,  setShowNewMenu]  = useState(false);

  const newMenuRef = useRef(null);
  const navigate   = useNavigate();

  const fetchChats = useCallback(async () => {
    try {
      const res = await API.get("/chat");
      setChats(res.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  useEffect(() => {
    // ── Named handlers — MUST pass the same reference to socket.off() ──────
    // Using bare socket.off("event") without a ref removes ALL listeners for
    // that event globally, including ones registered by ChatWindow, breaking
    // real-time for the other component. Always use named refs.

    const onOnline = (users) => setOnlineUsers(users);

    const onNewMsg = ({ chatId, message }) => {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === chatId);
        if (idx === -1) { fetchChats(); return prev; }
        const updated = {
          ...prev[idx],
          lastMessage: message,
          unreadCount: chatId !== selectedChatId ? (prev[idx].unreadCount || 0) + 1 : 0,
        };
        const rest = prev.filter((c) => c._id !== chatId);
        return [updated, ...rest];
      });
    };

    const onReceive = (msg) => {
      const chatId = msg.chat || msg.chat?._id;
      if (!chatId) return;
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === chatId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], lastMessage: msg };
        return [updated, ...prev.filter((c) => c._id !== chatId)];
      });
    };

    const onRead = ({ chatId }) => {
      setChats((prev) => prev.map((c) => c._id === chatId ? { ...c, unreadCount: 0 } : c));
    };

    const onChatDel = ({ chatId }) => {
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      onChatDeleted?.(chatId);
    };

    socket.on("online-users",             onOnline);
    socket.on("new-message-notification", onNewMsg);
    socket.on("receive-message",          onReceive);
    socket.on("messages-read",            onRead);
    socket.on("chat-deleted",             onChatDel);

    return () => {
      // Pass handler refs — this only removes OUR listeners, not ChatWindow's
      socket.off("online-users",             onOnline);
      socket.off("new-message-notification", onNewMsg);
      socket.off("receive-message",          onReceive);
      socket.off("messages-read",            onRead);
      socket.off("chat-deleted",             onChatDel);
    };
  }, [selectedChatId, fetchChats]);

  // Clear unread badge when chat is selected
  useEffect(() => {
    if (!selectedChatId) return;
    setChats((prev) => prev.map((c) => c._id === selectedChatId ? { ...c, unreadCount: 0 } : c));
  }, [selectedChatId]);

  // Close the + dropdown when clicking outside
  useEffect(() => {
    if (!showNewMenu) return;
    const h = (e) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setShowNewMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showNewMenu]);

  const totalUnread = chats.reduce((n, c) => n + (c.unreadCount || 0), 0);

  const filtered = chats.filter((c) => {
    if (c.isGroup) return c.groupName?.toLowerCase().includes(search.toLowerCase());
    const other = c.participants.find((p) => p._id !== user._id);
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const handleGroupCreated = (newChat) => {
    setShowNewGroup(false);
    setChats((prev) => [newChat, ...prev]);
    onSelectChat(newChat);
  };

  return (
    <>
      <AnimatePresence>
        {showNewGroup && (
          <CreateGroupModal
            onClose={() => setShowNewGroup(false)}
            onCreated={handleGroupCreated}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
                CHATS
              </h1>
              {totalUnread > 0 && (
                <motion.span key={totalUnread} initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                  className="bg-purple-600 text-[10px] font-black px-2 py-0.5 rounded-full text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </motion.span>
              )}
            </div>

            {/* + dropdown — New Group / Communities */}
            <div className="relative" ref={newMenuRef}>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowNewMenu((v) => !v)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-all border ${
                  showNewMenu
                    ? "bg-purple-600/25 border-purple-500/40 text-purple-300"
                    : "bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                }`}
                title="New conversation"
              >
                <motion.span
                  animate={{ rotate: showNewMenu ? 45 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-lg leading-none"
                >
                  +
                </motion.span>
              </motion.button>

              <AnimatePresence>
                {showNewMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1,    y: 0  }}
                    exit={{   opacity: 0, scale: 0.92, y: -4  }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
                  >
                    {/* New Group */}
                    <button
                      onClick={() => { setShowNewMenu(false); setShowNewGroup(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left group"
                    >
                      <span className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/25 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600/30 transition-colors">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">New Group</p>
                        <p className="text-[10px] text-zinc-500">Create a private group chat</p>
                      </div>
                    </button>

                    <div className="h-px bg-white/[0.05] mx-3" />

                    {/* Communities */}
                    <button
                      onClick={() => { setShowNewMenu(false); navigate("/communities"); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left group"
                    >
                      <span className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600/30 transition-colors">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Communities</p>
                        <p className="text-[10px] text-zinc-500">Explore or create communities</p>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-purple-500/5 rounded-xl blur-lg group-focus-within:bg-purple-500/10 transition-all" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="relative w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 pl-4 pr-4 text-sm focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-600" />
          </div>

          {/* ── Tab pills ── */}
          <div className="flex gap-1 mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {[
              { id: "chats", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", label: "Chats" },
              { id: "calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", label: "Calls" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-purple-600/20 text-purple-300 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Calls tab ── */}
        {activeTab === "calls" ? (
          <div className="flex-1 min-h-0">
            <CallHistory onCallAgain={onCallAgain} />
          </div>
        ) : (

        /* ── Chats list ── */
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-4 scrollbar-hide min-h-0">
          <AnimatePresence initial={false}>
            {filtered.length === 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-zinc-600 text-sm pt-10">
                {search ? "No results" : "No conversations yet"}
              </motion.p>
            )}
            {filtered.map((chat, idx) => {
              const isGroup  = chat.isGroup;
              const other    = !isGroup && chat.participants.find((p) => p._id !== user._id);
              if (!isGroup && !other) return null;

              const name     = isGroup ? chat.groupName : other.name;
              const avatar   = isGroup ? null : other.avatar;
              const isOnline = !isGroup && onlineUsers.includes(other._id);
              const isSelected = selectedChatId === chat._id;
              const unread   = chat.unreadCount || 0;
              const preview  = lastMsgPreview(chat, user._id);
              const timeStr  = fmtTime(chat.lastMessage?.createdAt || chat.updatedAt);

              return (
                <motion.div key={chat._id} layout
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.02, layout: { duration: 0.18 } }}
                  onClick={() => onSelectChat(chat)}
                  className={`group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected ? "bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-500 rounded-full" />}

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {isGroup ? (
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border border-white/10 text-white font-bold text-sm ${isSelected ? "scale-105" : ""}`}>
                        {name?.slice(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <img src={avatar || "/avatar.png"} className={`w-12 h-12 rounded-2xl object-cover border border-white/10 ${isSelected ? "scale-105" : ""}`} alt="" />
                    )}
                    {isOnline && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-[#09090b]" />}
                    {isGroup && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5 gap-1">
                      <span className={`text-sm font-bold truncate ${isSelected ? "text-white" : unread > 0 ? "text-zinc-100" : "text-zinc-300"}`}>{name}</span>
                      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-tighter flex-shrink-0">{timeStr}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${unread > 0 ? "text-zinc-200 font-semibold" : "text-zinc-500"}`}>{preview}</p>
                      {unread > 0 && (
                        <motion.span key={unread} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                          className="bg-purple-600 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-[0_0_10px_rgba(147,51,234,0.5)] flex-shrink-0 text-white">
                          {unread > 99 ? "99+" : unread}
                        </motion.span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        )} {/* end activeTab === "calls" ternary */}
      </div>
    </>
  );
}

export default ChatSidebar;