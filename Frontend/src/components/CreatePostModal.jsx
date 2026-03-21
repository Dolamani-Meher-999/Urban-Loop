import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, Upload, Send } from "lucide-react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

// ─── Filters ──────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "normal",    label: "Original", style: "" },
  { id: "clarendon", label: "Chrome",   style: "contrast(1.2) saturate(1.35)" },
  { id: "moon",      label: "Void",     style: "grayscale(1) contrast(1.1) brightness(1.1)" },
  { id: "juno",      label: "Neon",     style: "saturate(1.6) contrast(1.1) hue-rotate(10deg)" },
  { id: "reyes",     label: "Dust",     style: "sepia(0.3) brightness(1.1) contrast(0.85)" },
  { id: "lark",      label: "Lark",     style: "contrast(0.9) brightness(1.15) saturate(1.25)" },
  { id: "slumber",   label: "Slumber",  style: "saturate(0.66) brightness(1.05)" },
  { id: "aden",      label: "Haze",     style: "hue-rotate(-20deg) contrast(0.9) brightness(1.2)" },
];

// Bake CSS filter into image via canvas before upload
const applyFilterToBlob = (imgEl, filterStyle) =>
  new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width  = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (filterStyle) ctx.filter = filterStyle;
    ctx.drawImage(imgEl, 0, 0);
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });

// ─── CreatePostModal ──────────────────────────────────────────────────────────
// Steps:
//   1 → Pick photo (drag-drop / click / paste)
//   2 → Choose filter
//   3 → Write caption + share
export default function CreatePostModal({ onClose, onPosted }) {
  const { user } = useAuth();

  const [step,       setStep]       = useState(1);
  const [file,       setFile]       = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [filter,     setFilter]     = useState(FILTERS[0]);
  const [caption,    setCaption]    = useState("");
  const [charCount,  setCharCount]  = useState(0);
  const [dragging,   setDragging]   = useState(false);
  const [posting,    setPosting]    = useState(false);
  const [error,      setError]      = useState("");

  const fileInputRef = useRef(null);
  const imgRef       = useRef(null);

  const MAX_CAPTION = 2200;

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // ── Accept file ────────────────────────────────────────────────────────
  const acceptFile = useCallback(async (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Only image files are supported (JPEG, PNG, GIF, WebP)."); return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("Image must be under 20 MB."); return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
      setFile(f);
      setStep(2);
    };
    reader.readAsDataURL(f);
  }, []);

  // Drag handlers
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()    => setDragging(false);
  const onDrop      = (e)   => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files[0]); };

  // Paste from clipboard
  const onPaste = useCallback((e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) acceptFile(item.getAsFile());
  }, [acceptFile]);

  useEffect(() => {
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onPaste]);

  // ── Caption ────────────────────────────────────────────────────────────
  const handleCaptionChange = (e) => {
    const val = e.target.value;
    if (val.length <= MAX_CAPTION) { setCaption(val); setCharCount(val.length); }
  };

  // ── Back ───────────────────────────────────────────────────────────────
  const goBack = () => {
    if (step === 2) { setStep(1); setFile(null); setPreviewUrl(null); setFilter(FILTERS[0]); }
    else if (step === 3) { setStep(2); }
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!file) return;
    setPosting(true);
    setError("");
    try {
      let uploadBlob = file;
      if (filter.style && imgRef.current) {
        uploadBlob = await applyFilterToBlob(imgRef.current, filter.style);
      }
      const fd = new FormData();
      fd.append("image",   uploadBlob, `post-${Date.now()}.jpg`);
      fd.append("caption", caption.trim());
      const res = await API.post("/posts", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onPosted?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const STEP_LABEL = ["", "Upload", "Enhance", "Finalize"][step];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="bg-zinc-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col w-full"
        style={{
          maxWidth: step === 3 ? 820 : 500,
          maxHeight: "92vh",
          transition: "max-width 0.25s ease",
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <button
            onClick={step === 1 ? onClose : goBack}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            {step === 1 ? <X size={20} /> : <ChevronLeft size={20} />}
          </button>

          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">{STEP_LABEL}</h2>

          <div className="w-10 flex justify-end">
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="text-purple-400 hover:text-purple-300 font-black text-xs uppercase tracking-wider transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════
            STEP 1 — Pick photo
        ════════════════════════════════════ */}
        {step === 1 && (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-6 px-8 py-16 cursor-pointer transition-all
              ${dragging ? "bg-purple-500/10" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files[0])}
            />

            <motion.div
              animate={dragging ? { scale: 1.1 } : { scale: 1 }}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-colors
                ${dragging ? "bg-purple-600/20 border border-purple-500/40" : "bg-purple-600/10 border border-purple-500/20"}`}
            >
              <Upload className={dragging ? "text-purple-400" : "text-purple-500"} size={32} />
            </motion.div>

            <div className="text-center">
              <p className="text-white font-bold text-lg">
                {dragging ? "Drop to upload!" : "Drop your photo here"}
              </p>
              <p className="text-zinc-500 text-sm mt-1 font-medium">
                or click to browse · Ctrl+V to paste
              </p>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="px-7 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-purple-900/40"
            >
              Select from device
            </button>

            {error && (
              <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 w-full max-w-xs text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════
            STEP 2 — Choose filter
        ════════════════════════════════════ */}
        {step === 2 && previewUrl && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Preview */}
            <div className="bg-black flex items-center justify-center" style={{ maxHeight: 420, minHeight: 200 }}>
              <img
                ref={imgRef}
                src={previewUrl}
                alt="preview"
                className="max-w-full max-h-[420px] object-contain"
                style={{ filter: filter.style || "none" }}
                crossOrigin="anonymous"
              />
            </div>

            {/* Filter strip */}
            <div className="flex-shrink-0 border-t border-white/5 bg-zinc-900 p-4">
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f)}
                    className={`flex flex-col items-center gap-2 flex-shrink-0 transition-all active:scale-95
                      ${filter.id === f.id ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
                  >
                    <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all
                      ${filter.id === f.id ? "border-purple-500 shadow-lg shadow-purple-900/50" : "border-transparent hover:border-white/20"}`}>
                      <img
                        src={previewUrl}
                        alt={f.label}
                        className="w-full h-full object-cover"
                        style={{ filter: f.style || "none" }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-tighter
                      ${filter.id === f.id ? "text-purple-400" : "text-zinc-500"}`}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════
            STEP 3 — Caption + Share
        ════════════════════════════════════ */}
        {step === 3 && previewUrl && (
          <div className="flex flex-1 min-h-0" style={{ minHeight: 400 }}>

            {/* Left: image */}
            <div
              className="bg-black flex items-center justify-center flex-shrink-0"
              style={{ width: "52%", minWidth: 240 }}
            >
              <img
                src={previewUrl}
                alt="preview"
                className="w-full h-full object-contain"
                style={{ filter: filter.style || "none", maxHeight: 500 }}
              />
            </div>

            {/* Right: caption panel */}
            <div
              className="flex flex-col border-l border-white/5"
              style={{ flex: 1, minWidth: 240 }}
            >
              {/* User info */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 flex-shrink-0">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10"
                    alt={user.name}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  {user?.username || user?.name}
                </span>
              </div>

              {/* Caption textarea */}
              <div className="flex-1 px-5 py-4 min-h-0">
                <textarea
                  autoFocus
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder="Encrypt a message…"
                  className="w-full h-full min-h-[100px] bg-transparent text-sm text-zinc-300 placeholder:text-zinc-700 resize-none outline-none leading-relaxed"
                />
              </div>

              {/* Char counter */}
              <div className="px-5 pb-2 flex justify-end flex-shrink-0">
                <span className={`text-[11px] tabular-nums transition-colors
                  ${charCount > MAX_CAPTION - 100 ? "text-amber-400" : "text-zinc-700"}`}>
                  {charCount} / {MAX_CAPTION}
                </span>
              </div>

              <div className="h-px bg-white/5 flex-shrink-0" />

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden flex-shrink-0"
                  >
                    <div className="mx-4 my-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-xs">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Share button */}
              <div className="px-5 py-5 flex-shrink-0">
                <button
                  onClick={handlePost}
                  disabled={posting || !file}
                  className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500
                    disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs
                    font-black uppercase tracking-[0.2em] transition-all
                    shadow-[0_0_20px_rgba(147,51,234,0.3)] flex items-center justify-center gap-2"
                >
                  {posting
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Send size={14} /> Transmit</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

      </motion.div>
    </motion.div>
  );
}