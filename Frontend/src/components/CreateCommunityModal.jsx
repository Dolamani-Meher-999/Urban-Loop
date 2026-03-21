import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Globe, Lock, Radio, MessageSquare } from "lucide-react";
import API from "../services/api";

export default function CreateCommunityModal({ onClose, onCreated }) {
  const [name,          setName]          = useState("");
  const [description,   setDescription]   = useState("");
  const [isPublic,      setIsPublic]      = useState(true);
  const [broadcastOnly, setBroadcastOnly] = useState(false);
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [creating,      setCreating]      = useState(false);
  const [error,         setError]         = useState("");

  const fileRef  = useRef(null);
  const nameRef  = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleAvatarChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Community name is required."); return; }
    setCreating(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("name",          name.trim());
      fd.append("description",   description.trim());
      fd.append("isPublic",      isPublic);
      fd.append("broadcastOnly", broadcastOnly);
      if (avatarFile) fd.append("avatar", avatarFile);

      const res = await API.post("/community", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCreated?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create community.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1,    y: 0,  opacity: 1 }}
        exit={{    scale: 0.95, y: 20, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h2 className="text-sm font-bold text-white">Create Community</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar picker */}
          <div className="flex justify-center">
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-2xl cursor-pointer group"
            >
              {avatarPreview ? (
                <img src={avatarPreview} className="w-full h-full object-cover rounded-2xl border border-white/10" alt="" />
              ) : (
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center border border-white/10">
                  <Upload size={28} className="text-white/70" />
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                <Upload size={20} className="text-white" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-1.5">
              Community Name *
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Bhubaneswar Cyclists"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What is this community about?"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
            />
          </div>

          {/* Visibility toggle */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: true,  Icon: Globe, label: "Public",  sub: "Anyone in your city can join" },
                { val: false, Icon: Lock,  label: "Private", sub: "Invite only" },
              ].map(({ val, Icon, label, sub }) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setIsPublic(val)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    isPublic === val
                      ? "border-purple-500/60 bg-purple-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={18} className={isPublic === val ? "text-purple-400 mt-0.5 flex-shrink-0" : "text-zinc-500 mt-0.5 flex-shrink-0"} />
                  <div>
                    <p className={`text-xs font-bold ${isPublic === val ? "text-purple-300" : "text-zinc-300"}`}>{label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Broadcast-only toggle */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
              Message Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: false, Icon: MessageSquare, label: "Open Chat",  sub: "All members can message" },
                { val: true,  Icon: Radio,         label: "Broadcast",  sub: "Only you can send messages" },
              ].map(({ val, Icon, label, sub }) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setBroadcastOnly(val)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    broadcastOnly === val
                      ? "border-indigo-500/60 bg-indigo-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={18} className={broadcastOnly === val ? "text-indigo-400 mt-0.5 flex-shrink-0" : "text-zinc-500 mt-0.5 flex-shrink-0"} />
                  <div>
                    <p className={`text-xs font-bold ${broadcastOnly === val ? "text-indigo-300" : "text-zinc-300"}`}>{label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
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

          {/* Submit */}
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2"
          >
            {creating
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : "Create Community"
            }
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}