import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker, { Theme } from "emoji-picker-react";
import API from "../services/api";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import CreatePollModal from "./CreatePollModal";
import PollBubble from "./PollBubble";
import ForwardModal from "./ForwardModal";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDuration = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

const fileInfo = (mime = "", name = "") => {
  if (mime.startsWith("image/"))   return { label: "Image", icon: "photo", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
  if (mime.startsWith("video/"))   return { label: "Video", icon: "video", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" };
  if (mime.startsWith("audio/"))   return { label: "Voice", icon: "mic",   color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  if (mime === "application/pdf")  return { label: "PDF",   icon: "pdf",   color: "text-red-400 bg-red-500/10 border-red-500/20" };
  if (mime.includes("word"))       return { label: "Word",  icon: "doc",   color: "text-sky-400 bg-sky-500/10 border-sky-500/20" };
  if (mime.includes("excel") || mime.includes("sheet"))
                                   return { label: "Excel", icon: "doc",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  if (mime === "application/zip")  return { label: "ZIP",   icon: "zip",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  const ext = (name.split(".").pop() || "").toUpperCase();
  return { label: ext || "File", icon: "doc", color: "text-zinc-400 bg-zinc-700/50 border-zinc-600/30" };
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const PATHS = {
  photo:    "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  video:    "M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  mic:      "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
  pdf:      "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  doc:      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  zip:      "M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  x:        "M6 18L18 6M6 6l12 12",
  send:     "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  emoji:    "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  dots:     "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z",
  edit:     "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  trash:    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  phone:    "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  play:     "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  pause:    "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z",
  flip:     "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  forward:  "M13 7l5 5m0 0l-5 5m5-5H6",
};
const Icon = ({ id, className = "w-5 h-5", style }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={PATHS[id] || PATHS.doc} />
  </svg>
);

// ─── VoiceRecorder ────────────────────────────────────────────────────────────
function VoiceRecorder({ onRecorded, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  const [volume,  setVolume]  = useState(0);
  const mediaRecRef  = useRef(null);
  const streamRef    = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const rafRef       = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const tick = () => {
          if (!mounted) return;
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          setVolume(Math.min(data.reduce((a, b) => a + b, 0) / data.length / 100, 1));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        mediaRecRef.current = rec;
        rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
          cancelAnimationFrame(rafRef.current);
          ctx.close();
          stream.getTracks().forEach((t) => t.stop());
          if (cancelledRef.current || !mounted) return;
          const finalMime = mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: finalMime });
          onRecorded(new File([blob], `voice-${Date.now()}.webm`, { type: finalMime }));
        };
        rec.start(200);
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch (err) {
        console.error("Mic error:", err);
        if (mounted) onCancel();
      }
    })();
    return () => { mounted = false; };
  }, []);

  const stop = () => { clearInterval(timerRef.current); if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current.stop(); };
  const cancel = () => {
    cancelledRef.current = true;
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const bars = Array.from({ length: 20 }, (_, i) => {
    const center = Math.abs(i - 9.5) / 9.5;
    return Math.max(0.08, (1 - center * 0.5) * volume + 0.15 * Math.random() * volume);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-red-500/25 rounded-2xl"
    >
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
      <div className="flex items-center gap-[2px] h-7">
        {bars.map((h, i) => (
          <div key={i} className="w-[3px] rounded-full bg-red-400 origin-center transition-transform duration-75"
            style={{ height: "100%", transform: `scaleY(${h})` }} />
        ))}
      </div>
      <span className="text-red-400 text-sm font-mono tabular-nums flex-shrink-0">{fmtDuration(seconds)}</span>
      <span className="text-zinc-500 text-xs flex-1">Recording…</span>
      <button onClick={cancel} className="text-xs text-zinc-500 hover:text-white px-3 py-1.5 rounded-xl border border-white/5 hover:bg-white/5 transition-all">Cancel</button>
      <button onClick={stop} className="text-xs text-white font-semibold px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 transition-all">Send</button>
    </motion.div>
  );
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({ src, isMine }) {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current,  setCurrent]  = useState(0);
  const audioRef = useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;
    playing ? audioRef.current.pause() : audioRef.current.play();
    setPlaying(!playing);
  };
  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.getBoundingClientRect().width));
    audioRef.current.currentTime = ratio * duration;
    setProgress(ratio);
  };
  const track = isMine ? "bg-white/20" : "bg-zinc-700";
  const fill  = isMine ? "bg-white"    : "bg-purple-400";
  const btn   = isMine ? "bg-white/20 hover:bg-white/30 text-white" : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-400";

  return (
    <div className="flex items-center gap-3 py-0.5 w-full" style={{ minWidth: 180 }}>
      <audio ref={audioRef} src={src} preload="metadata"
        onTimeUpdate={() => { if (!audioRef.current) return; const c = audioRef.current.currentTime; setCurrent(c); setProgress(c / (audioRef.current.duration || 1)); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
      />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${btn}`}>
        <Icon id={playing ? "pause" : "play"} className="w-4 h-4" />
      </button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`relative h-1.5 rounded-full cursor-pointer ${track}`} onClick={seek}>
          <div className={`absolute left-0 top-0 h-full rounded-full ${fill}`} style={{ width: `${progress * 100}%` }} />
          <div className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow ${fill}`} style={{ left: `calc(${progress * 100}% - 5px)` }} />
        </div>
        <span className={`text-[10px] tabular-nums ${isMine ? "text-purple-200/60" : "text-zinc-500"}`}>
          {fmtDuration(playing ? current : duration)}
        </span>
      </div>
    </div>
  );
}

// ─── AttachmentPreview ────────────────────────────────────────────────────────
function AttachmentPreview({ file, onClear }) {
  const isImage = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");
  const isVideo = file.type.startsWith("video/");
  const { label, icon, color } = fileInfo(file.type, file.name);
  const previewUrl = useMemo(() => (isImage || isAudio || isVideo) ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }} className="mx-1 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
      {isImage && previewUrl && (
        <div className="relative">
          <img src={previewUrl} className="w-full max-h-52 object-cover" alt="preview" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button onClick={onClear} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-all"><Icon id="x" className="w-3.5 h-3.5" /></button>
          <div className="absolute bottom-2 left-3 right-10 flex items-center justify-between">
            <span className="text-xs text-white/80 font-medium truncate">{file.name}</span>
            <span className="text-[10px] text-white/50 flex-shrink-0 ml-2">{fmtSize(file.size)}</span>
          </div>
        </div>
      )}
      {isVideo && previewUrl && (
        <div className="relative">
          <video src={previewUrl} className="w-full max-h-52 object-cover bg-black" muted />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"><Icon id="play" className="w-5 h-5 text-white" /></div>
          </div>
          <button onClick={onClear} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-all"><Icon id="x" className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {isAudio && previewUrl && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${color}`}><Icon id="mic" className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0"><p className="text-xs font-medium text-zinc-200 truncate">{file.name}</p><p className="text-[10px] text-zinc-500 mt-0.5">{fmtSize(file.size)}</p></div>
          <audio src={previewUrl} controls style={{ height: 28, width: 110 }} />
          <button onClick={onClear} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"><Icon id="x" className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {!isImage && !isVideo && !isAudio && (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border flex-shrink-0 gap-0.5 ${color}`}>
            <Icon id={icon} className="w-5 h-5" />
            <span className="text-[7px] font-bold uppercase tracking-wide opacity-80 leading-none">{label}</span>
          </div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p><p className="text-[11px] text-zinc-500 mt-0.5">{fmtSize(file.size)}</p></div>
          <button onClick={onClear} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"><Icon id="x" className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </motion.div>
  );
}

// ─── FileAttachmentBubble ─────────────────────────────────────────────────────
function FileAttachmentBubble({ msg, isMine }) {
  const { icon, label, color } = fileInfo(msg.fileType, msg.fileName || "");
  return (
    <a href={msg.fileUrl} target="_blank" rel="noreferrer"
      className={`flex items-center gap-3 mb-1 p-2.5 rounded-xl transition-all ${isMine ? "bg-purple-500/20 hover:bg-purple-500/30" : "bg-white/5 hover:bg-white/10"}`}>
      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border flex-shrink-0 gap-0.5 ${color}`}>
        <Icon id={icon} style={{ width: 18, height: 18 }} className="w-4 h-4" />
        <span className="text-[7px] font-bold uppercase tracking-wide opacity-80 leading-none">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isMine ? "text-white" : "text-zinc-200"}`}>{msg.fileName || "Download file"}</p>
        <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isMine ? "text-purple-200/60" : "text-zinc-500"}`}><Icon id="download" className="w-3 h-3" /> Open or download</p>
      </div>
    </a>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, otherUser, onReact, onEdit, onDelete, onVotePoll, onForward }) {
  const [showActions,   setShowActions]   = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!showActions && !showReactions) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setShowActions(false); setShowReactions(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showActions, showReactions]);

  const submitEdit = () => { if (editText.trim() && editText !== msg.text) onEdit(msg._id, editText); setEditing(false); };
  const isDeleted = msg.deletedForEveryone;
  const isSeen = msg.seenBy?.some((id) => id === otherUser?._id || id?._id === otherUser?._id);
  const time = fmt(msg.createdAt);
  const reactionCounts = useMemo(
    () => (msg.reactions || []).reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {}),
    [msg.reactions]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} items-end gap-2`}>
      {!isMine && <img src={otherUser?.avatar || "/avatar.png"} className="w-7 h-7 rounded-full object-cover mb-1 flex-shrink-0" alt="" />}
      <div className="group relative max-w-[72%]" ref={wrapRef}>
        {!isDeleted && (
          <div className={`absolute ${isMine ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 z-10`}>
            <button onClick={() => { setShowReactions((v) => !v); setShowActions(false); }} className="p-1.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"><Icon id="emoji" className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setShowActions((v) => !v); setShowReactions(false); }} className="p-1.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"><Icon id="dots" className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <AnimatePresence>
          {showReactions && (
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 8 }}
              className={`absolute ${isMine ? "right-0" : "left-0"} -top-12 z-20 flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-2xl px-2.5 py-1.5 shadow-2xl`}>
              {REACTIONS.map((e) => <button key={e} onClick={() => { onReact(msg._id, e); setShowReactions(false); }} className="text-xl hover:scale-125 transition-transform active:scale-95">{e}</button>)}
            </motion.div>
          )}
        </AnimatePresence>
          <AnimatePresence>
          {showActions && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`absolute ${isMine ? "right-0" : "left-0"} -top-[116px] z-20 flex flex-col bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[160px]`}>
              {isMine && msg.text && !isDeleted && (
                <button onClick={() => { setEditing(true); setShowActions(false); }} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 transition-all"><Icon id="edit" className="w-3.5 h-3.5" /> Edit</button>
              )}
              {/* Forward — available on any non-deleted, non-poll message */}
              {!isDeleted && !msg.poll && (
                <button onClick={() => { onForward?.(msg); setShowActions(false); }}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 transition-all border-t border-white/[0.04] first:border-t-0">
                  <Icon id="forward" className="w-3.5 h-3.5" /> Forward
                </button>
              )}
              <button onClick={() => { onDelete(msg._id, false); setShowActions(false); }} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-400 hover:bg-white/5 transition-all border-t border-white/[0.04]"><Icon id="trash" className="w-3.5 h-3.5" /> Delete for me</button>
              {isMine && <button onClick={() => { onDelete(msg._id, true); setShowActions(false); }} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-all border-t border-white/5"><Icon id="trash" className="w-3.5 h-3.5" /> Delete for everyone</button>}
            </motion.div>
          )}
        </AnimatePresence>
        {editing ? (
          <div className="flex items-center gap-2 bg-zinc-800 border border-purple-500/40 rounded-2xl px-3 py-2 min-w-[200px]">
            <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditing(false); }}
              className="bg-transparent outline-none text-sm text-zinc-100 flex-1" />
            <button onClick={submitEdit} className="text-purple-400 hover:text-purple-300 text-xs font-semibold">Save</button>
            <button onClick={() => setEditing(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
          </div>
        ) : msg.poll && !isDeleted ? (
          /* Poll messages get their own bubble from PollBubble — no outer padding wrapper */
          <PollBubble
            poll={msg.poll}
            isMine={isMine}
            onVote={(idxs) => onVotePoll(msg._id, idxs)}
          />
        ) : (
          <div className={`px-4 py-3 shadow-lg ${isMine ? "bg-purple-600 text-white rounded-[22px] rounded-br-none" : "bg-zinc-900/80 backdrop-blur-md text-zinc-200 rounded-[22px] rounded-bl-none border border-white/5"}`}>
            {isDeleted ? (
              <p className="text-[13px] italic opacity-40 select-none">Message deleted</p>
            ) : (
              <>
                {/* Forwarded label */}
                {msg.isForwarded && (
                  <div className={`flex items-center gap-1 mb-1.5 ${isMine ? "text-purple-200/60" : "text-zinc-500"}`}>
                    <Icon id="forward" className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest">Forwarded</span>
                  </div>
                )}
                {msg.image && <img src={msg.image} loading="lazy" alt="shared" className="rounded-xl max-w-full mb-2 cursor-zoom-in hover:opacity-90 transition-opacity block" style={{ maxHeight: 260 }} onClick={() => window.open(msg.image, "_blank")} />}
                {msg.voice && <div className="mb-2"><AudioPlayer src={msg.voice} isMine={isMine} /></div>}
                {msg.fileUrl && msg.fileType?.startsWith("video/") && <video controls src={msg.fileUrl} className="rounded-xl max-w-full mb-2 block" style={{ maxHeight: 220 }} />}
                {msg.fileUrl && !msg.fileType?.startsWith("video/") && <FileAttachmentBubble msg={msg} isMine={isMine} />}
                {msg.poll && (
                  <PollBubble
                    poll={msg.poll}
                    isMine={isMine}
                    onVote={(idxs) => onVotePoll?.(msg._id, idxs)}
                  />
                )}
                {msg.text && <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>}
                <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest ${isMine ? "text-purple-200/60" : "text-zinc-500"}`}>
                  <span>{time}</span>
                  {msg.isEdited && <span>· edited</span>}
                  {isMine && <span className={isSeen ? "text-sky-300" : ""}>· {isSeen ? "Seen" : "Sent"}</span>}
                </div>
              </>
            )}
          </div>
        )}
        {Object.keys(reactionCounts).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${isMine ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button key={emoji} onClick={() => onReact(msg._id, emoji)} className="flex items-center gap-0.5 bg-zinc-800/90 border border-white/10 rounded-full px-2 py-0.5 text-sm hover:bg-zinc-700 transition-all active:scale-95">
                {emoji}{count > 1 && <span className="text-[10px] text-zinc-400 ml-0.5">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── CameraModal ──────────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const recRef    = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef  = useRef(null);

  const [mode,       setMode]       = useState("photo");
  const [recording,  setRecording]  = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState("environment");
  const [permErr,    setPermErr]    = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [streamReady, setStreamReady] = useState(false);

  // ── Start stream — try facingMode first, fall back to any camera ──────────
  const startStream = useCallback(async (facing, currentMode) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPermErr(null);
    setStreamReady(false);

    const attach = (stream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    try {
      attach(await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: currentMode === "video",
      }));
    } catch {
      try {
        attach(await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: currentMode === "video",
        }));
      } catch {
        try {
          attach(await navigator.mediaDevices.getUserMedia({ video: true, audio: currentMode === "video" }));
        } catch (err) {
          setPermErr(
            err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
              ? "Camera access denied. Click the camera icon in your browser's address bar and allow access."
              : err.name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start camera: " + err.message
          );
        }
      }
    }
  }, []);

  useEffect(() => {
    startStream(facingMode, mode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
  }, [facingMode, mode]);

  // Play video as soon as srcObject is set — avoids race condition with autoplay
  const handleVideoRef = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  // ── Photo capture ─────────────────────────────────────────────────────────
  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    const w = video.videoWidth  || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // mirror if front camera
    if (facingMode === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setPreview({ url: URL.createObjectURL(blob), type: "photo", blob });
    }, "image/jpeg", 0.92);
  };

  // ── Video recording ───────────────────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
    const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {});
    recRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const finalMime = mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      setPreview({ url: URL.createObjectURL(blob), type: "video", blob, mimeType: finalMime });
    };
    rec.start(200);
    setRecording(true);
    setRecSeconds(0);
    timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recRef.current?.state !== "inactive") recRef.current.stop();
    setRecording(false);
  };

  const sendCapture = () => {
    if (!preview) return;
    const isPhoto = preview.type === "photo";
    const file = new File(
      [preview.blob],
      `camera-${Date.now()}.${isPhoto ? "jpg" : "webm"}`,
      { type: isPhoto ? "image/jpeg" : preview.mimeType || "video/webm" }
    );
    URL.revokeObjectURL(preview.url);
    onCapture(file);
  };

  const retake = () => {
    URL.revokeObjectURL(preview?.url);
    setPreview(null);
    // restart stream after retake
    startStream(facingMode, mode);
  };

  const flip = () => {
    if (recording) return;
    setPreview(null);
    setFacingMode((f) => f === "environment" ? "user" : "environment");
  };

  const fmtSec = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Drag — raw pointer events, no framer-motion on the window itself ────────
  const dragRef    = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Initialise position directly — lazy useState so it's never null
  const [pos, setPos] = useState(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    return {
      x: Math.round((W - 380) / 2),        // horizontally centred
      y: Math.max(20, H - 460 - 60),        // above the chat footer
    };
  });

  const onPointerDown = (e) => {
    if (e.target.closest("button")) return;  // don't drag when clicking buttons
    isDragging.current = true;
    const rect = dragRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!isDragging.current || !dragRef.current) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - dragRef.current.offsetWidth,  e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - dragRef.current.offsetHeight, e.clientY - dragOffset.current.y)),
    });
  };

  const onPointerUp = () => { isDragging.current = false; };

  return (
    /* Invisible full-screen layer — only for z-index stacking, not blocking clicks */
    <div className="fixed inset-0 z-[100] pointer-events-none">

      {/* Floating window — pointer-events-auto so it works normally */}
      <div
        ref={dragRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="pointer-events-auto bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden flex flex-col"
        style={{
          position:   "fixed",
          left:       pos.x,
          top:        pos.y,
          width:      380,
          userSelect: "none",
          /* Smooth reposition while dragging, instant on first paint */
          transition: isDragging.current ? "none" : "box-shadow 0.2s",
        }}
      >
        {/* ── Header / drag handle ── */}
        <div
          onPointerDown={onPointerDown}
          className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] bg-zinc-900 flex-shrink-0 select-none"
          style={{ cursor: "grab" }}
        >
          <div className="flex items-center gap-2">
            {/* 6-dot grip */}
            <div className="flex flex-col gap-[3px] opacity-30 flex-shrink-0">
              {[0,1].map(r => (
                <div key={r} className="flex gap-[3px]">
                  {[0,1,2].map(c => <div key={c} className="w-[3px] h-[3px] rounded-full bg-zinc-300" />)}
                </div>
              ))}
            </div>
            {/* Photo / Video toggle */}
            <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5">
              {["photo", "video"].map((m) => (
                <button key={m}
                  onClick={() => { if (!recording) { setPreview(null); setMode(m); } }}
                  className={`px-3.5 py-1 rounded-full text-[11px] font-bold capitalize transition-all ${mode === m ? "bg-white text-black shadow" : "text-zinc-400 hover:text-white"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button onClick={flip} title="Flip camera"
              className={`p-1.5 rounded-lg transition-all ${recording ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
              <Icon id="flip" className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
              <Icon id="x" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Viewfinder — aspect ratio = always same height, never overflows ── */}
        <div className="relative bg-black flex-shrink-0" style={{ aspectRatio: "4/3", width: "100%" }}>
          {permErr ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
              <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p className="text-zinc-400 text-xs leading-relaxed">{permErr}</p>
              <button onClick={() => startStream(facingMode, mode)}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all">
                Try again
              </button>
            </div>
          ) : preview ? (
            preview.type === "photo"
              ? <img src={preview.url} className="w-full h-full object-contain bg-black" alt="captured" />
              : <video src={preview.url} className="w-full h-full object-contain bg-black" controls autoPlay loop />
          ) : (
            <video
              ref={handleVideoRef}
              autoPlay playsInline muted
              onCanPlay={() => setStreamReady(true)}
              className="w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          )}

          {/* Loading spinner */}
          {!permErr && !preview && !streamReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Recording badge */}
          {recording && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-[10px] font-mono font-bold">{fmtSec(recSeconds)}</span>
            </div>
          )}

          {/* Mode label */}
          {!preview && !permErr && (
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full pointer-events-none">
              <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest">{mode}</span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* ── Controls — always visible, always below viewfinder ── */}
        <div className="flex items-center justify-center gap-8 px-5 py-4 bg-zinc-950 flex-shrink-0">
          {preview ? (
            <>
              <button onClick={retake}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-all text-xs font-semibold">
                <Icon id="flip" className="w-3.5 h-3.5" /> Retake
              </button>
              <button onClick={sendCapture}
                className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white transition-all text-xs font-bold shadow-lg shadow-emerald-900/40">
                <Icon id="send" className="w-3.5 h-3.5" /> Send
              </button>
            </>
          ) : mode === "photo" ? (
            <button onClick={takePhoto}
              className="w-14 h-14 rounded-full bg-white hover:bg-zinc-200 active:scale-90 transition-all shadow-xl flex items-center justify-center">
              <span className="w-11 h-11 rounded-full border-[3px] border-zinc-400 block" />
            </button>
          ) : recording ? (
            <button onClick={stopRecording}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 active:scale-90 transition-all shadow-xl flex items-center justify-center">
              <span className="w-5 h-5 rounded-md bg-white block" />
            </button>
          ) : (
            <button onClick={startRecording}
              className="w-14 h-14 rounded-full border-[3px] border-white hover:border-zinc-200 active:scale-90 transition-all shadow-xl flex items-center justify-center bg-transparent">
              <span className="w-10 h-10 rounded-full bg-red-500 block" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AttachMenu ───────────────────────────────────────────────────────────────
const ATTACH_OPTIONS = [
  { id: "image",    label: "Photo / Video", accept: "image/*,video/*",                      bg: "bg-pink-500",    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { id: "document", label: "Document",      accept: ".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip", bg: "bg-blue-500",    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: "audio",    label: "Audio",         accept: "audio/*",                              bg: "bg-amber-500",   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg> },
  { id: "camera",   label: "Camera",                                                         bg: "bg-emerald-500", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: "poll",     label: "Poll",                                                           bg: "bg-violet-500",  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
];

function AttachMenu({ onFile, onOpenCamera, onOpenPoll }) {
  const [open, setOpen] = useState(false);
  const menuRef   = useRef(null);
  const inputRefs = useRef({});

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handlePick = (opt) => {
    setOpen(false);
    if (opt.id === "camera") { setTimeout(() => onOpenCamera(), 100); return; }
    if (opt.id === "poll")   { setTimeout(() => onOpenPoll(),  100); return; }
    setTimeout(() => inputRefs.current[opt.id]?.click(), 80);
  };

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      {ATTACH_OPTIONS.filter((o) => o.id !== "camera" && o.id !== "poll").map((opt) => (
        <input key={opt.id} ref={(el) => (inputRefs.current[opt.id] = el)} type="file" className="hidden" accept={opt.accept}
          onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
      ))}

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.16 }}
              className="absolute bottom-full left-0 mb-3 z-50 flex flex-col gap-2">
              {[...ATTACH_OPTIONS].reverse().map((opt, i) => (
                <motion.button key={opt.id}
                  initial={{ opacity: 0, x: -12, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: 0.9 }}
                  transition={{ delay: i * 0.04, duration: 0.16 }}
                  onClick={() => handlePick(opt)}
                  className="flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full shadow-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-200 hover:text-white transition-all group whitespace-nowrap">
                  <span className={`w-9 h-9 rounded-full ${opt.bg} flex items-center justify-center text-white flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>{opt.icon}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-xl transition-colors ${open ? "text-purple-400 bg-purple-500/15" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      </motion.button>
    </div>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────
function ChatWindow({ chat, onDeleteChat }) {
  const { user } = useAuth();
  const [messages,        setMessages]        = useState([]);
  const [text,            setText]            = useState("");
  const [typingUsers,     setTypingUsers]     = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile,    setSelectedFile]    = useState(null);
  const [showCamera,      setShowCamera]      = useState(false);
  const [showPoll,        setShowPoll]        = useState(false);
  const [pollSubmitting,  setPollSubmitting]  = useState(false);
  const [forwardingMsg,   setForwardingMsg]   = useState(null);
  const [recording,       setRecording]       = useState(false);
  const [sending,         setSending]         = useState(false);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [page,            setPage]            = useState(1);
  const [hasMore,         setHasMore]         = useState(true);
  const [isOnline,        setIsOnline]        = useState(false);

  const bottomRef    = useRef();
  const pickerRef    = useRef();
  const typingTimer  = useRef(null);
  const containerRef = useRef();

  const otherUser = chat.isGroup
    ? null
    : chat.participants.find((p) => p._id !== user._id && p._id !== user.id)
      ?? chat.participants.find((p) => p._id !== user._id);

  const displayName = chat.isGroup ? chat.groupName : otherUser?.name;
  const displayAvatar = chat.isGroup ? (chat.groupAvatar || null) : otherUser?.avatar;

  const fetchMessages = useCallback(async (pg = 1, prepend = false) => {
    try {
      if (pg > 1) setLoadingMore(true);
      const res = await API.get(`/messages/${chat._id}?page=${pg}&limit=40`);
      const fetched = res.data;
      if (fetched.length < 40) setHasMore(false);
      setMessages((prev) => prepend ? [...fetched, ...prev] : fetched);
    } catch (err) { console.error("fetchMessages:", err); }
    finally { setLoadingMore(false); }
  }, [chat._id]);

  useEffect(() => {
    setMessages([]); setPage(1); setHasMore(true); setRecording(false);
    setSelectedFile(null); setShowEmojiPicker(false);
    fetchMessages(1).then(() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 60));
    socket.emit("join-chat", chat._id);
    API.put(`/messages/read/${chat._id}`).catch(() => {});
    socket.emit("seen-message", { chatId: chat._id, userId: user._id });
  }, [chat._id]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || loadingMore || !hasMore) return;
    if (containerRef.current.scrollTop < 60) { setPage((p) => { fetchMessages(p + 1, true); return p + 1; }); }
  }, [loadingMore, hasMore, fetchMessages]);

  useEffect(() => {
    const onMsg = (msg) => {
      if (msg.chat !== chat._id && msg.chat?._id !== chat._id) return;
      setMessages((p) => p.some((m) => m._id === msg._id) ? p : [...p, msg]);
      API.put(`/messages/read/${chat._id}`).catch(() => {});
      socket.emit("seen-message", { chatId: chat._id, userId: user._id });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    };
    const onTyping      = ({ chatId, userId }) => { if (chatId === chat._id && userId !== user._id) setTypingUsers((p) => new Set([...p, userId])); };
    const onStopTyping  = ({ chatId, userId }) => { if (chatId === chat._id) setTypingUsers((p) => { const s = new Set(p); s.delete(userId); return s; }); };
    const onEdited      = ({ messageId, text: t }) => setMessages((p) => p.map((m) => m._id === messageId ? { ...m, text: t, isEdited: true } : m));
    const onDeleted     = ({ messageId, forEveryone }) => setMessages((p) => forEveryone ? p.map((m) => m._id === messageId ? { ...m, deletedForEveryone: true, text: "" } : m) : p.filter((m) => m._id !== messageId));
    const onReaction    = ({ messageId, reactions }) => setMessages((p) => p.map((m) => m._id === messageId ? { ...m, reactions } : m));
    const onPollUpdated = ({ messageId, poll }) => setMessages((p) => p.map((m) => m._id === messageId ? { ...m, poll } : m));
    const onRead        = ({ chatId, readBy }) => { if (chatId !== chat._id || readBy === user._id) return; setMessages((p) => p.map((m) => (m.sender === user._id || m.sender?._id === user._id) ? { ...m, seenBy: [...new Set([...(m.seenBy || []), readBy])] } : m)); };
    const onOnline      = (users) => setIsOnline(users.includes(otherUser?._id));
    const onChatDel     = ({ chatId }) => { if (chatId === chat._id) onDeleteChat?.(chatId); };

    socket.on("receive-message", onMsg); socket.on("user-typing", onTyping); socket.on("stop-typing", onStopTyping);
    socket.on("message-edited", onEdited); socket.on("message-deleted", onDeleted); socket.on("reaction-updated", onReaction);
    socket.on("poll-updated", onPollUpdated);
    socket.on("messages-read", onRead); socket.on("online-users", onOnline); socket.on("chat-deleted", onChatDel);
    return () => {
      socket.off("receive-message", onMsg); socket.off("user-typing", onTyping); socket.off("stop-typing", onStopTyping);
      socket.off("message-edited", onEdited); socket.off("message-deleted", onDeleted); socket.off("reaction-updated", onReaction);
      socket.off("poll-updated", onPollUpdated);
      socket.off("messages-read", onRead); socket.off("online-users", onOnline); socket.off("chat-deleted", onChatDel);
    };
  }, [chat._id, user._id, otherUser?._id]);

  useEffect(() => {
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowEmojiPicker(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit("typing", { chatId: chat._id, userId: user._id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("stop-typing", { chatId: chat._id, userId: user._id }), 2000);
  };

  const sendMessage = async () => {
    if (!text.trim() && !selectedFile) return;
    setSending(true);
    socket.emit("stop-typing", { chatId: chat._id, userId: user._id });
    try {
      let res;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("chatId", chat._id);
        if (text.trim()) fd.append("text", text.trim());
        fd.append("file", selectedFile);
        res = await API.post("/messages", fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        res = await API.post("/messages", { chatId: chat._id, text: text.trim() });
      }
      setMessages((p) => p.some((m) => m._id === res.data._id) ? p : [...p, res.data]);
      setText(""); setSelectedFile(null); setShowEmojiPicker(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) { console.error("Send failed:", err); }
    finally { setSending(false); }
  };

  const handleReact  = async (id, emoji) => { try { const r = await API.post(`/messages/${id}/react`, { emoji }); setMessages((p) => p.map((m) => m._id === id ? { ...m, reactions: r.data } : m)); } catch (e) { console.error(e); } };
  const handleEdit   = async (id, t) => { try { await API.put(`/messages/${id}`, { text: t }); setMessages((p) => p.map((m) => m._id === id ? { ...m, text: t, isEdited: true } : m)); } catch (e) { console.error(e); } };
  const handleDelete = async (id, all) => { try { await API.delete(`/messages/${id}${all ? "?everyone=true" : ""}`); setMessages((p) => all ? p.map((m) => m._id === id ? { ...m, deletedForEveryone: true, text: "" } : m) : p.filter((m) => m._id !== id)); } catch (e) { console.error(e); } };
  const handleDeleteChat = async () => { if (!window.confirm("Delete this entire conversation?")) return; try { await API.delete(`/chat/${chat._id}`); onDeleteChat?.(chat._id); } catch (e) { console.error(e); } };

  // ── Poll handlers ──────────────────────────────────────────────────────────
  const handleSendPoll = async ({ question, options, allowMultiple }) => {
    setPollSubmitting(true);
    try {
      const res = await API.post("/messages/poll", {
        chatId: chat._id, question, options, allowMultiple,
      });
      setMessages((p) => p.some((m) => m._id === res.data._id) ? p : [...p, res.data]);
      setShowPoll(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) { console.error(err); }
    finally { setPollSubmitting(false); }
  };

  const handleVotePoll = async (messageId, optionIndexes) => {
    try {
      const res = await API.post(`/messages/${messageId}/vote`, { optionIndexes });
      setMessages((p) => p.map((m) => m._id === messageId ? { ...m, poll: res.data } : m));
    } catch (err) { console.error(err); }
  };

  return (
    // CameraModal is rendered here at the TOP LEVEL — not inside the footer/overlay chain
    // This lets position:fixed work correctly without being clipped by backdrop-filter ancestors
    <>
      <AnimatePresence>
        {showCamera && (
          <CameraModal
            onCapture={(f) => { setShowCamera(false); setSelectedFile(f); }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPoll && (
          <CreatePollModal
            onClose={() => setShowPoll(false)}
            onSubmit={handleSendPoll}
            submitting={pollSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {forwardingMsg && (
          <ForwardModal
            message={forwardingMsg}
            onClose={() => setForwardingMsg(null)}
            onDone={() => setForwardingMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* ⚠️ IMPORTANT: h-full works because ChatPage wraps this in absolute inset-0 */}
      <div className="flex flex-col h-full bg-[#0c0c0e]">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] backdrop-blur-2xl bg-black/40 z-30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            {chat.isGroup ? (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm ring-1 ring-white/20">
                {displayName?.slice(0, 2).toUpperCase()}
              </div>
            ) : (
              <img src={displayAvatar || "/avatar.png"} className="w-11 h-11 rounded-2xl object-cover ring-1 ring-white/20" alt="" />
            )}
            {!chat.isGroup && (
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-4 border-[#0c0c0e] ${isOnline ? "bg-emerald-500" : "bg-zinc-700"}`} />
            )}
          </div>
          <div>
            <h2 className="font-bold text-white tracking-tight">{displayName}</h2>
            <div className="flex items-center gap-1.5">
              {chat.isGroup ? (
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {chat.participants?.length} members
                </span>
              ) : (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {isOnline ? "Active" : "Offline"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!chat.isGroup && (
            <button className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all border border-white/5">
              <Icon id="phone" className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleDeleteChat} className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-all border border-white/5">
            <Icon id="trash" className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-hide min-h-0">
        {loadingMore && <div className="flex justify-center py-2"><div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg._id} msg={msg}
              isMine={msg.sender === user._id || msg.sender?._id === user._id}
              otherUser={otherUser} onReact={handleReact} onEdit={handleEdit}
              onDelete={handleDelete} onVotePoll={handleVotePoll} onForward={setForwardingMsg} />
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {typingUsers.size > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex items-center gap-2 pl-9">
              <div className="flex items-center gap-1 bg-zinc-900/80 border border-white/5 rounded-[20px] rounded-bl-none px-4 py-3">
                {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <footer className="p-4 pt-2 flex-shrink-0">
        <div className="relative">
          <AnimatePresence>
            {selectedFile && <AttachmentPreview file={selectedFile} onClear={() => setSelectedFile(null)} />}
          </AnimatePresence>
          {recording ? (
            <VoiceRecorder onRecorded={(f) => { setSelectedFile(f); setRecording(false); }} onCancel={() => setRecording(false)} />
          ) : (
            <>
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div ref={pickerRef} initial={{ opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.92 }}
                    className="absolute bottom-16 right-0 z-50 shadow-2xl">
                    <EmojiPicker theme={Theme.DARK} onEmojiClick={(e) => setText((t) => t + e.emoji)} autoFocusSearch={false} width={320} height={380} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-[2rem] opacity-0 group-focus-within:opacity-15 blur-md transition-opacity pointer-events-none" />
                <div className="relative flex items-center gap-2 bg-[#121214] border border-white/10 p-2 rounded-[1.8rem] backdrop-blur-3xl">
                  <AttachMenu onFile={setSelectedFile} onOpenCamera={() => setShowCamera(true)} onOpenPoll={() => setShowPoll(true)} />
                  <input value={text} onChange={handleTyping} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..." className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-600 px-2 min-w-0" />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setRecording(true)} className="p-2 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                      <Icon id="mic" className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 rounded-full transition-all ${showEmojiPicker ? "text-purple-400 bg-purple-500/10" : "text-zinc-500 hover:text-white"}`}>
                      <Icon id="emoji" className="w-5 h-5" />
                    </button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={sendMessage}
                      disabled={sending || (!text.trim() && !selectedFile)}
                      className="ml-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-20 text-white p-2.5 rounded-full shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-all flex items-center justify-center">
                      {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon id="send" className="w-5 h-5" />}
                    </motion.button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
    </>
  );
}

export default ChatWindow;