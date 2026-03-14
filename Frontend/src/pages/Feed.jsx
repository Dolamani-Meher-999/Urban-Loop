import { useEffect, useState, useRef, useCallback } from "react";
import API from "../services/api";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, X, Bold, Italic } from "lucide-react";
import StarBackground from "../components/StarBackground";
import FloatingNav from "../components/FloatingNav";
import { useAuth } from "../context/AuthContext";

function Feed() {
  const { user: loggedUser } = useAuth();

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const [burstPostId, setBurstPostId] = useState(null);
  const [lastTap, setLastTap] = useState(0);

  const [writeModalPost, setWriteModalPost] = useState(null);
  const [readModalPost, setReadModalPost] = useState(null);

  const [commentText, setCommentText] = useState("");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  const observer = useRef();

  // ================= Fetch Posts =================
  const fetchPosts = async () => {
    if (!hasMore || loading) return;

    setLoading(true);

    try {
      const res = await API.get(`/posts/feed?page=${page}&limit=5`);
      setPosts((prev) => [...prev, ...res.data.posts]);
      setHasMore(res.data.hasMore);
      setPage((prev) => prev + 1);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // ================= Infinite Scroll =================
  const lastPostRef = useCallback(
    (node) => {
      if (loading) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) fetchPosts();
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  // ================= Like =================
  const handleLike = async (postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? {
              ...p,
              likes: p.likedByUser
                ? p.likes.slice(0, -1)
                : [...p.likes, "temp"],
              likedByUser: !p.likedByUser,
            }
          : p
      )
    );

    try {
      await API.put(`/posts/like/${postId}`);
    } catch (err) {
      console.log(err);
    }
  };

  // ================= Double Tap =================
  const handleDoubleTap = (postId) => {
    const now = Date.now();

    if (lastTap && now - lastTap < 300) {
      handleLike(postId);
      setBurstPostId(postId);

      setTimeout(() => setBurstPostId(null), 800);
    }

    setLastTap(now);
  };

  // ================= Add Comment =================
  const handleAddComment = async () => {
    if (!commentText.trim() || !writeModalPost) return;

    const formattedText = `
${isBold ? "**" : ""}${isItalic ? "_" : ""}${commentText}${
      isItalic ? "_" : ""
    }${isBold ? "**" : ""}
`;

    try {
      const res = await API.post(`/posts/comment/${writeModalPost._id}`, {
        text: formattedText,
      });

      setPosts((prev) =>
        prev.map((p) =>
          p._id === writeModalPost._id
            ? { ...p, comments: res.data }
            : p
        )
      );

      setCommentText("");
      setIsBold(false);
      setIsItalic(false);
      setWriteModalPost(null);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 overflow-hidden">
      <StarBackground />
      <FloatingNav />

      <div className="relative z-10 flex justify-center px-4 pt-28 pb-10">
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
                {/* USER HEADER */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${post.user._id}`}>
                      <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {post.user?.name?.charAt(0)}
                      </div>
                    </Link>

                    <Link
                      to={`/profile/${post.user._id}`}
                      className="text-white font-semibold hover:text-purple-400"
                    >
                      {post.user?.name}
                    </Link>
                  </div>

                  {/* MESSAGE BUTTON (disabled for self) */}
                  {post.user._id !== loggedUser?._id && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link
                        to={`/chat/${post.user._id}`}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl
                        bg-gradient-to-r from-purple-600 to-indigo-600
                        hover:from-purple-500 hover:to-indigo-500
                        text-white text-sm font-medium
                        shadow-lg shadow-purple-900/40 transition"
                      >
                        <MessageCircle size={16} />
                        Message
                      </Link>
                    </motion.div>
                  )}
                </div>

                {/* IMAGE */}
                {post.image && (
                  <div
                    className="relative cursor-pointer"
                    onClick={() => handleDoubleTap(post._id)}
                  >
                    <img
                      src={post.image}
                      alt="post"
                      className="w-full object-cover max-h-[500px]"
                    />

                    <AnimatePresence>
                      {burstPostId === post._id && (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1.4, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <Heart size={110} fill="white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex items-center gap-5 px-4 py-3 text-zinc-400">
                  <motion.button
                    whileTap={{ scale: 1.3 }}
                    animate={{ scale: post.likedByUser ? 1.2 : 1 }}
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-2 ${
                      post.likedByUser
                        ? "text-red-500"
                        : "hover:text-red-500"
                    }`}
                  >
                    <Heart
                      size={20}
                      fill={post.likedByUser ? "currentColor" : "none"}
                    />
                    {post.likes.length}
                  </motion.button>

                  <button
                    onClick={() => setWriteModalPost(post)}
                    className="flex items-center gap-2 hover:text-purple-400"
                  >
                    <MessageCircle size={20} />
                    {post.comments.length}
                  </button>
                </div>

                {/* CAPTION */}
                <div className="px-4 pb-4 text-sm text-white">
                  <span className="font-semibold mr-2">
                    {post.user?.name}
                  </span>
                  {post.caption}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Feed;