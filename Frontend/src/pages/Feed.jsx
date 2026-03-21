import { useEffect, useState, useRef, useCallback } from "react";
import API from "../services/api";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";
import StarBackground from "../components/StarBackground";
import FloatingNav from "../components/FloatingNav";
import { useAuth } from "../context/AuthContext";

function Feed() {
  const { user: loggedUser } = useAuth();

  const [posts,       setPosts]       = useState([]);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [loading,     setLoading]     = useState(false);
  const [burstPostId, setBurstPostId] = useState(null);
  const [lastTap,     setLastTap]     = useState(0);

  // comment modal state
  const [writeModalPost, setWriteModalPost] = useState(null);
  const [commentText,    setCommentText]    = useState("");

  const observer    = useRef();
  const pageRef     = useRef(1);
  const hasMoreRef  = useRef(true);
  const loadingRef  = useRef(false);

  // ── Fetch posts ─────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!hasMoreRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await API.get(`/posts/feed?page=${pageRef.current}&limit=5`);
      setPosts((prev) => [...prev, ...res.data.posts]);
      hasMoreRef.current = res.data.hasMore;
      setHasMore(res.data.hasMore);
      pageRef.current += 1;
      setPage(pageRef.current);
    } catch (err) {
      console.error(err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, []);

  // ── Infinite scroll sentinel ────────────────────────────────────────────
  const lastPostRef = useCallback((node) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreRef.current) fetchPosts();
    });
    if (node) observer.current.observe(node);
  }, [loading, fetchPosts]);

  // ── Like ────────────────────────────────────────────────────────────────
  const handleLike = async (postId) => {
    // Snapshot current state for rollback
    const prev = posts.find((p) => p._id === postId);
    if (!prev) return;

    const wasLiked   = prev.likedByUser;
    const prevCount  = prev.likesCount ?? prev.likes?.length ?? 0;

    // Optimistic update — flip state and adjust count by ±1
    setPosts((all) =>
      all.map((p) =>
        p._id === postId
          ? { ...p, likedByUser: !wasLiked, likesCount: wasLiked ? prevCount - 1 : prevCount + 1 }
          : p
      )
    );

    try {
      const res = await API.put(`/posts/like/${postId}`);
      // Reconcile with the server's real count (handles any race condition)
      setPosts((all) =>
        all.map((p) =>
          p._id === postId ? { ...p, likesCount: res.data.likesCount } : p
        )
      );
    } catch (err) {
      // Rollback on failure
      setPosts((all) =>
        all.map((p) =>
          p._id === postId ? { ...p, likedByUser: wasLiked, likesCount: prevCount } : p
        )
      );
      console.error(err);
    }
  };

  // ── Double-tap to like ──────────────────────────────────────────────────
  const handleDoubleTap = (postId) => {
    const now = Date.now();
    if (lastTap && now - lastTap < 300) {
      handleLike(postId);
      setBurstPostId(postId);
      setTimeout(() => setBurstPostId(null), 800);
    }
    setLastTap(now);
  };

  // ── Add comment ─────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!commentText.trim() || !writeModalPost) return;
    try {
      const res = await API.post(`/posts/comment/${writeModalPost._id}`, {
        text: commentText.trim(),
      });
      setPosts((prev) =>
        prev.map((p) => p._id === writeModalPost._id ? { ...p, comments: res.data } : p)
      );
      setCommentText("");
      setWriteModalPost(null);
    } catch (err) { console.error(err); }
  };

  return (
    /*
     * KEY FIX: was "overflow-hidden" which blocks all page scrolling.
     * Use "overflow-y-auto" so the feed scrolls normally.
     * min-h-screen keeps the background full height even when posts are few.
     */
    <div className="relative min-h-screen bg-zinc-950">
      <StarBackground />
      <FloatingNav />

      <div className="relative z-10 flex justify-center px-4 pt-28 pb-16">
        <div className="w-full max-w-xl space-y-8">

          {posts.map((post, index) => {
            const isLast = posts.length === index + 1;
            return (
              <motion.div
                ref={isLast ? lastPostRef : null}
                key={post._id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl overflow-hidden"
              >
                {/* User header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${post.user._id}`}>
                      {post.user?.avatar ? (
                        <img src={post.user.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {post.user?.name?.charAt(0)}
                        </div>
                      )}
                    </Link>
                    <Link to={`/profile/${post.user._id}`} className="text-white font-semibold hover:text-purple-400 transition-colors">
                      {post.user?.name}
                    </Link>
                  </div>

                  {post.user._id !== loggedUser?._id && (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Link
                        to={`/chat/${post.user._id}`}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl
                          bg-gradient-to-r from-purple-600 to-indigo-600
                          hover:from-purple-500 hover:to-indigo-500
                          text-white text-sm font-medium shadow-lg shadow-purple-900/40 transition"
                      >
                        <MessageCircle size={16} /> Message
                      </Link>
                    </motion.div>
                  )}
                </div>

                {/* Image */}
                {post.image && (
                  <div className="relative cursor-pointer" onClick={() => handleDoubleTap(post._id)}>
                    <img src={post.image} alt="post" className="w-full object-cover max-h-[500px]" />
                    <AnimatePresence>
                      {burstPostId === post._id && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1.4, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <Heart size={110} fill="white" className="text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-5 px-4 py-3 text-zinc-400">
                  <motion.button
                    whileTap={{ scale: 1.3 }}
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-2 transition-colors ${post.likedByUser ? "text-red-500" : "hover:text-red-500"}`}
                  >
                    <Heart size={20} fill={post.likedByUser ? "currentColor" : "none"} />
                    {post.likesCount ?? post.likes?.length ?? 0}
                  </motion.button>

                  <button
                    onClick={() => { setWriteModalPost(post); setCommentText(""); }}
                    className="flex items-center gap-2 hover:text-purple-400 transition-colors"
                  >
                    <MessageCircle size={20} />
                    {post.comments.length}
                  </button>
                </div>

                {/* Caption */}
                {post.caption && (
                  <div className="px-4 pb-4 text-sm text-white">
                    <span className="font-semibold mr-2">{post.user?.name}</span>
                    <span className="text-zinc-300">{post.caption}</span>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Loading spinner */}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          )}

          {/* End of feed */}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-zinc-600 text-xs uppercase tracking-widest py-8">
              You're all caught up
            </p>
          )}
        </div>
      </div>

      {/* ── Comment modal ── */}
      <AnimatePresence>
        {writeModalPost && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setWriteModalPost(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">Add comment</h3>
                <button onClick={() => setWriteModalPost(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4">
                <textarea
                  autoFocus
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Write a comment…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              <div className="px-4 pb-4">
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold transition-all"
                >
                  Post Comment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Feed;