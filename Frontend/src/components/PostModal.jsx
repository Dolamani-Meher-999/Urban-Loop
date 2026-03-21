import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, MessageCircle, Send, Trash2, MoreHorizontal } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

// ─── helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};

function PostModal({ post: initialPost, onClose, onDeleted, onUpdated }) {
  const { user: loggedUser } = useAuth();

  const [post,         setPost]         = useState(initialPost);
  const [liked,        setLiked]        = useState(false);
  const [likeCount,    setLikeCount]    = useState(0);
  const [comments,     setComments]     = useState([]);
  const [commentText,  setCommentText]  = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [showMenu,     setShowMenu]     = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [likeAnim,     setLikeAnim]     = useState(false);
  const [doubleTapPos, setDoubleTapPos] = useState(null);

  const commentInputRef = useRef(null);
  const lastTap         = useRef(0);

  const isOwn = post?.user?._id === loggedUser?._id || post?.user === loggedUser?._id;

  // Sync when prop changes
  useEffect(() => {
    if (!initialPost) return;
    setPost(initialPost);
    setLikeCount(initialPost.likes?.length ?? 0);
    setLiked(
      (initialPost.likes || []).some(
        (id) => (id?._id || id)?.toString() === loggedUser?._id?.toString()
      )
    );
    setComments(initialPost.comments || []);
    setShowMenu(false);
    setCommentText("");
  }, [initialPost?._id]);

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ── Like ────────────────────────────────────────────────────────────────────
  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 600); }
    try {
      await API.put(`/posts/like/${post._id}`);
      onUpdated?.({ ...post, likes: next ? [...(post.likes || []), loggedUser._id] : (post.likes || []).filter((id) => (id?._id || id)?.toString() !== loggedUser._id.toString()) });
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  // ── Double-tap to like ─────────────────────────────────────────────────────
  const handleImageTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      setDoubleTapPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setDoubleTapPos(null), 900);
      if (!liked) handleLike();
    }
    lastTap.current = now;
  };

  // ── Comment ────────────────────────────────────────────────────────────────
  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/posts/comment/${post._id}`, { text: commentText.trim() });
      setComments(res.data);
      setCommentText("");
      onUpdated?.({ ...post, comments: res.data });
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      await API.delete(`/posts/${post._id}`);
      onDeleted?.(post._id);
      onClose();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  };

  return (
    <AnimatePresence>
      {initialPost && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Close button */}
          <button onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10">
            <X size={18} />
          </button>

          <motion.div
            initial={{ scale: 0.93, y: 30, opacity: 0 }}
            animate={{ scale: 1,    y: 0,  opacity: 1 }}
            exit={{    scale: 0.93, y: 30, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl w-full flex flex-col md:flex-row"
            style={{ maxWidth: 900, maxHeight: "90vh" }}
          >
            {/* ── Left: image ── */}
            <div className="md:w-[56%] bg-black flex items-center justify-center relative flex-shrink-0"
              style={{ minHeight: 280 }}
              onClick={handleImageTap}
            >
              {post?.image ? (
                <img src={post.image} alt="post"
                  className="w-full h-full object-contain cursor-pointer select-none"
                  style={{ maxHeight: "90vh" }}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-64 flex items-center justify-center text-zinc-700">
                  <MessageCircle size={48} />
                </div>
              )}

              {/* Double-tap heart burst */}
              <AnimatePresence>
                {doubleTapPos && (
                  <motion.div
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 1.3, opacity: 1 }}
                    exit={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute pointer-events-none"
                    style={{ left: doubleTapPos.x - 40, top: doubleTapPos.y - 40 }}
                  >
                    <Heart size={80} className="text-white drop-shadow-lg" fill="white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Right: info + comments ── */}
            <div className="flex flex-col flex-1 min-h-0 border-t md:border-t-0 md:border-l border-white/[0.07]">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
                <Link to={`/profile/${post?.user?._id || post?.user}`}
                  onClick={onClose}
                  className="flex items-center gap-3 group">
                  {post?.user?.avatar ? (
                    <img src={post.user.avatar} className="w-9 h-9 rounded-full object-cover ring-2 ring-transparent group-hover:ring-purple-500/50 transition-all" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {post?.user?.name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors leading-tight">
                      {post?.user?.username || post?.user?.name}
                    </p>
                    {post?.user?.city && (
                      <p className="text-[10px] text-zinc-500">{post.user.city}</p>
                    )}
                  </div>
                </Link>

                {/* More menu (delete for own posts) */}
                {isOwn && (
                  <div className="relative">
                    <button onClick={() => setShowMenu((v) => !v)}
                      className="p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
                      <MoreHorizontal size={18} />
                    </button>
                    <AnimatePresence>
                      {showMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: -4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 mt-1 w-36 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20"
                        >
                          <button onClick={handleDelete} disabled={deleting}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50">
                            <Trash2 size={15} />
                            {deleting ? "Deleting…" : "Delete Post"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Caption */}
              {post?.caption && (
                <div className="px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
                  <div className="flex gap-3">
                    {post?.user?.avatar ? (
                      <img src={post.user.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
                        {post?.user?.name?.charAt(0) || "U"}
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-bold text-white mr-2">{post?.user?.username || post?.user?.name}</span>
                      <span className="text-sm text-zinc-300 leading-relaxed">{post.caption}</span>
                      <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(post.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 scrollbar-hide">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-700 py-8">
                    <MessageCircle size={32} />
                    <p className="text-sm">No comments yet</p>
                    <p className="text-xs">Be the first to comment</p>
                  </div>
                ) : (
                  comments.map((c, i) => (
                    <div key={c._id || i} className="flex gap-3">
                      {c.user?.avatar ? (
                        <img src={c.user.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
                          {c.user?.name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-white mr-2">{c.user?.username || c.user?.name || "User"}</span>
                        <span className="text-xs text-zinc-300 leading-relaxed break-words">{c.text}</span>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(c.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Actions + like count */}
              <div className="border-t border-white/[0.06] flex-shrink-0">
                <div className="flex items-center gap-1 px-3 pt-3 pb-1">
                  <motion.button
                    whileTap={{ scale: 1.25 }}
                    onClick={handleLike}
                    className={`p-2 rounded-xl transition-colors ${liked ? "text-red-500" : "text-zinc-400 hover:text-red-400"}`}
                  >
                    <motion.div
                      animate={likeAnim ? { scale: [1, 1.4, 0.9, 1.1, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <Heart size={22} fill={liked ? "currentColor" : "none"} />
                    </motion.div>
                  </motion.button>

                  <button
                    onClick={() => commentInputRef.current?.focus()}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
                  >
                    <MessageCircle size={22} />
                  </button>
                </div>

                <div className="px-4 pb-2">
                  {likeCount > 0 && (
                    <p className="text-sm font-bold text-white">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</p>
                  )}
                  {post?.createdAt && (
                    <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wide">{timeAgo(post.createdAt)} ago</p>
                  )}
                </div>

                {/* Comment input */}
                <form onSubmit={handleComment}
                  className="flex items-center gap-2 px-3 py-3 border-t border-white/[0.05]">
                  {loggedUser?.avatar ? (
                    <img src={loggedUser.avatar} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {loggedUser?.name?.charAt(0) || "U"}
                    </div>
                  )}
                  <input
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none min-w-0"
                    maxLength={500}
                  />
                  <button type="submit"
                    disabled={!commentText.trim() || submitting}
                    className="text-purple-400 hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0 p-1">
                    {submitting
                      ? <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      : <Send size={16} />
                    }
                  </button>
                </form>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PostModal;