import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Globe, Lock, Radio, MessageSquare,
  Settings, Trash2, Send, Image as ImageIcon, X, LogOut, BarChart2,
} from "lucide-react";
import API from "../services/api";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import StarBackground from "../components/StarBackground";
import CreatePollModal from "../components/CreatePollModal";
import PollBubble from "../components/PollBubble";

// ─── helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60)    return `${d}s`;
  if (d < 3600)  return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};

// ─── SettingsPanel ────────────────────────────────────────────────────────────
function SettingsPanel({ community, onClose, onUpdated, onDeleted }) {
  const [name,          setName]          = useState(community.name);
  const [description,   setDescription]   = useState(community.description || "");
  const [isPublic,      setIsPublic]      = useState(community.isPublic);
  const [broadcastOnly, setBroadcastOnly] = useState(community.broadcastOnly);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await API.patch(`/community/${community._id}/settings`, {
        name, description, isPublic, broadcastOnly,
      });
      onUpdated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this community? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await API.delete(`/community/${community._id}`);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete.");
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-20 bg-zinc-950 flex flex-col"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
        <h3 className="text-sm font-bold text-white">Community Settings</h3>
        <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-1.5">Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/50 transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-1.5">Description</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: true,  Icon: Globe, label: "Public",  sub: "Anyone in your city" },
              { val: false, Icon: Lock,  label: "Private", sub: "Invite only" },
            ].map(({ val, Icon, label, sub }) => (
              <button key={String(val)} type="button" onClick={() => setIsPublic(val)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left ${
                  isPublic === val ? "border-purple-500/60 bg-purple-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}>
                <Icon size={16} className={`${isPublic === val ? "text-purple-400" : "text-zinc-500"} mt-0.5 flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-bold ${isPublic === val ? "text-purple-300" : "text-zinc-300"}`}>{label}</p>
                  <p className="text-[10px] text-zinc-600">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message mode */}
        <div>
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Message Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: false, Icon: MessageSquare, label: "Open Chat",  sub: "All members can send" },
              { val: true,  Icon: Radio,         label: "Broadcast",  sub: "Only you can send" },
            ].map(({ val, Icon, label, sub }) => (
              <button key={String(val)} type="button" onClick={() => setBroadcastOnly(val)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left ${
                  broadcastOnly === val ? "border-indigo-500/60 bg-indigo-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}>
                <Icon size={16} className={`${broadcastOnly === val ? "text-indigo-400" : "text-zinc-500"} mt-0.5 flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-bold ${broadcastOnly === val ? "text-indigo-300" : "text-zinc-300"}`}>{label}</p>
                  <p className="text-[10px] text-zinc-600">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      <div className="p-5 border-t border-white/[0.07] space-y-2 flex-shrink-0">
        <button
          onClick={handleSave} disabled={saving || !name.trim()}
          className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white text-sm font-bold transition-all flex items-center justify-center"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Save Changes"}
        </button>
        <button
          onClick={handleDelete} disabled={deleting}
          className="w-full py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-bold transition-all flex items-center justify-center gap-2"
        >
          {deleting ? <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <><Trash2 size={15} /> Delete Community</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwnerMsg, onVotePoll }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2.5 ${isOwnerMsg ? "justify-end" : "justify-start"}`}
    >
      {!isOwnerMsg && (
        <div className="flex-shrink-0">
          {msg.sender?.avatar ? (
            <img src={msg.sender.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-xs">
              {msg.sender?.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
      )}
      <div className={`max-w-[70%] ${isOwnerMsg ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isOwnerMsg && (
          <span className="text-[10px] font-semibold text-zinc-500 px-1">
            {msg.sender?.name || "Unknown"}
          </span>
        )}
        <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
          isOwnerMsg
            ? "bg-purple-600 text-white rounded-br-none"
            : "bg-zinc-900/80 border border-white/[0.07] text-zinc-200 rounded-bl-none"
        }`}>
          {msg.image && (
            <img src={msg.image} className="rounded-xl max-w-full mb-2 block cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: 220 }} onClick={() => window.open(msg.image, "_blank")} alt="" />
          )}
          {msg.poll?.question && (
            <PollBubble
              poll={msg.poll}
              isMine={isOwnerMsg}
              onVote={(idxs) => onVotePoll?.(msg._id, idxs)}
            />
          )}
          {msg.text && <p className="text-sm leading-relaxed break-words">{msg.text}</p>}
        </div>
        <span className="text-[10px] text-zinc-600 px-1">{timeAgo(msg.createdAt)}</span>
      </div>
    </motion.div>
  );
}

// ─── CommunityRoom ────────────────────────────────────────────────────────────
export default function CommunityRoom() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [community,     setCommunity]     = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState("");
  const [imageFile,     setImageFile]     = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showMembers,   setShowMembers]   = useState(false);
  const [joiningLeave,  setJoiningLeave]  = useState(false);
  const [showPoll,      setShowPoll]      = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);

  const bottomRef  = useRef(null);
  const imgInputRef = useRef(null);

  const isOwner = community?.isOwner;
  const isMember = community?.isMember;
  // Can the current user type a message?
  const canSend = isMember && (!community?.broadcastOnly || isOwner);

  // ── Load community ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get(`/community/${id}`);
        setCommunity(res.data);
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error(err);
        if (err.response?.status === 403) navigate("/communities");
      } finally { setLoading(false); }
    })();
  }, [id]);

  // ── Join socket room ───────────────────────────────────────────────────
  useEffect(() => {
    socket.emit("join-community", id);
    return () => socket.emit("leave-community", id);
  }, [id]);

  // ── Socket events ──────────────────────────────────────────────────────
  useEffect(() => {
    const onMsg = ({ message }) => {
      setMessages((prev) =>
        prev.some((m) => m._id === message._id) ? prev : [...prev, message]
      );
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    };

    const onUpdated = ({ isPublic, broadcastOnly, name }) => {
      setCommunity((prev) => prev ? { ...prev, isPublic, broadcastOnly, name } : prev);
    };

    const onDeleted = () => navigate("/communities");

    const onMemberJoined = ({ user: newUser }) => {
      setCommunity((prev) => {
        if (!prev) return prev;
        const alreadyIn = prev.members?.some((m) => m._id === newUser._id);
        return alreadyIn ? prev : { ...prev, members: [...(prev.members || []), newUser] };
      });
    };

    const onPollUpdated = ({ messageId, poll }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, poll } : m));
    };

    socket.on("community-message",       onMsg);
    socket.on("community-updated",       onUpdated);
    socket.on("community-deleted",       onDeleted);
    socket.on("community-member-joined", onMemberJoined);
    socket.on("community-poll-updated",  onPollUpdated);

    return () => {
      socket.off("community-message",       onMsg);
      socket.off("community-updated",       onUpdated);
      socket.off("community-deleted",       onDeleted);
      socket.off("community-member-joined", onMemberJoined);
      socket.off("community-poll-updated",  onPollUpdated);
    };
  }, [navigate]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Send message ───────────────────────────────────────────────────────
  const handleSend = async () => {
    if ((!text.trim() && !imageFile) || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (imageFile)   fd.append("image", imageFile);

      await API.post(`/community/${id}/message`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setText(""); setImageFile(null); setImagePreview(null);
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const handleImagePick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    e.target.value = "";
  };

  const handleSendPoll = async ({ question, options, allowMultiple }) => {
    setPollSubmitting(true);
    try {
      await API.post(`/community/${id}/poll`, { question, options, allowMultiple });
      setShowPoll(false);
    } catch (err) { console.error(err); }
    finally { setPollSubmitting(false); }
  };

  const handleVotePoll = async (messageId, optionIndexes) => {
    try {
      const res = await API.post(`/community/${id}/poll/${messageId}/vote`, { optionIndexes });
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, poll: res.data } : m));
    } catch (err) { console.error(err); }
  };

  // ── Join/Leave ─────────────────────────────────────────────────────────
  const handleJoinLeave = async () => {
    setJoiningLeave(true);
    try {
      if (isMember) {
        await API.post(`/community/${id}/leave`);
        setCommunity((prev) => prev ? { ...prev, isMember: false } : prev);
      } else {
        await API.post(`/community/${id}/join`);
        setCommunity((prev) => prev ? { ...prev, isMember: true } : prev);
      }
    } catch (err) { console.error(err); }
    finally { setJoiningLeave(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  if (!community) return null;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white flex flex-col">
      <StarBackground />

      <div className="relative z-10 flex flex-col h-screen">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] backdrop-blur-2xl bg-black/40 flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => navigate("/communities")} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0">
              <ArrowLeft size={18} />
            </button>

            {community.avatar ? (
              <img src={community.avatar} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {community.name?.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-sm truncate">{community.name}</h2>
                {/* Badges */}
                {community.broadcastOnly && (
                  <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[9px] font-bold uppercase flex-shrink-0">
                    <Radio size={9} /> Broadcast
                  </span>
                )}
                {!community.isPublic && (
                  <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-zinc-700/50 border border-white/10 text-zinc-400 text-[9px] font-bold uppercase flex-shrink-0">
                    <Lock size={9} /> Private
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowMembers((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Users size={10} /> {community.members?.length || 0} members
              </button>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Join / Leave (non-owners) */}
            {!isOwner && (
              <button
                onClick={handleJoinLeave} disabled={joiningLeave}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  isMember
                    ? "bg-white/5 border-white/10 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                    : "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30"
                }`}
              >
                {joiningLeave
                  ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : isMember ? <><LogOut size={13} className="inline mr-1" />Leave</> : "Join"
                }
              </button>
            )}

            {/* Settings (owner only) */}
            {isOwner && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </header>

        {/* ── Members panel (slide in) ── */}
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex-shrink-0 border-b border-white/[0.07] bg-zinc-900/60 backdrop-blur-xl px-4 py-3 max-h-40 overflow-y-auto"
            >
              <div className="flex items-center gap-3 flex-wrap">
                {(community.members || []).map((m) => (
                  <div key={m._id} className="flex items-center gap-2">
                    {m.avatar
                      ? <img src={m.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-xs">{m.name?.charAt(0)}</div>
                    }
                    <span className="text-xs text-zinc-300">{m.name}</span>
                    {m._id === community.owner?._id && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">Owner</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-h-0">

          {/* Broadcast-only notice for non-owners */}
          {community.broadcastOnly && !isOwner && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto max-w-sm text-center"
            >
              <Radio size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300 font-medium">
                This is a broadcast community. Only the owner can send messages.
              </p>
            </motion.div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-700">
              <MessageSquare size={40} />
              <p className="text-sm">No messages yet. {canSend ? "Say something!" : ""}</p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              msg={msg}
              isOwnerMsg={msg.sender?._id === user?._id || msg.sender === user?._id}
              onVotePoll={handleVotePoll}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input footer ── */}
        {canSend ? (
          <footer className="flex-shrink-0 p-4 pt-2 border-t border-white/[0.07] bg-black/20">
            {/* Image preview */}
            <AnimatePresence>
              {imagePreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mb-2 relative w-24 overflow-hidden"
                >
                  <img src={imagePreview} className="w-24 h-24 rounded-xl object-cover" alt="" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white"
                  >
                    <X size={11} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-2xl px-3 py-2">
              <input
                ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick}
              />
              {/* Image attach */}
              <button
                onClick={() => imgInputRef.current?.click()}
                className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
                title="Attach image"
              >
                <ImageIcon size={18} />
              </button>
              {/* Poll */}
              <button
                onClick={() => setShowPoll(true)}
                className="p-1.5 rounded-xl text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all flex-shrink-0"
                title="Create poll"
              >
                <BarChart2 size={18} />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isOwner && community.broadcastOnly ? "Broadcast a message…" : "Type a message…"}
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none min-w-0"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                disabled={sending || (!text.trim() && !imageFile)}
                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white transition-all flex-shrink-0"
              >
                {sending
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send size={16} />
                }
              </motion.button>
            </div>
          </footer>
        ) : (
          /* Non-member or broadcast-only non-owner: no input, just info bar */
          !isMember ? (
            <footer className="flex-shrink-0 p-4 border-t border-white/[0.07]">
              <button
                onClick={handleJoinLeave}
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all"
              >
                Join to participate
              </button>
            </footer>
          ) : (
            <footer className="flex-shrink-0 px-4 py-3 border-t border-white/[0.07]">
              <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs">
                <Radio size={12} />
                <span>Only the owner can send messages</span>
              </div>
            </footer>
          )
        )}
      </div>

      {/* ── Poll modal ── */}
      <AnimatePresence>
        {showPoll && (
          <CreatePollModal
            onClose={() => setShowPoll(false)}
            onSubmit={handleSendPoll}
            submitting={pollSubmitting}
          />
        )}
      </AnimatePresence>

      {/* ── Settings panel ── */}
      <AnimatePresence>
        {showSettings && (
          <div className="absolute inset-0 z-30">
            <SettingsPanel
              community={community}
              onClose={() => setShowSettings(false)}
              onUpdated={(updated) => setCommunity((prev) => ({ ...prev, ...updated }))}
              onDeleted={() => navigate("/communities")}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}