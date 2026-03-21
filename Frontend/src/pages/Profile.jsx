import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Settings, LogOut, UserCircle, MessageCircle,
  UserPlus, UserCheck, UserMinus, Grid, Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import API from "../services/api";
import StarBackground from "../components/StarBackground";
import { useAuth } from "../context/AuthContext";
import LazyImage from "../components/LazyImage";
import PostModal from "../components/PostModal";
import EditProfileModal from "../components/EditProfileModal";
import CreatePostModal from "../components/CreatePostModal";

// ─── FollowButton ─────────────────────────────────────────────────────────────
function FollowButton({ profileId, initialFollowing, onFollowChange }) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [hovered,     setHovered]     = useState(false);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => { setIsFollowing(initialFollowing); }, [initialFollowing]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      const endpoint = next
        ? `/users/${profileId}/follow`
        : `/users/${profileId}/unfollow`;
      const res = await API.put(endpoint);
      onFollowChange?.(next, res.data.followersCount);
    } catch (err) {
      setIsFollowing(!next);
      console.error("Follow toggle failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={loading}
      className={`relative flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
        isFollowing
          ? "bg-white/5 border-white/10 text-zinc-400 hover:border-red-500/50 hover:text-red-400"
          : "bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]"
      } disabled:opacity-50`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : isFollowing ? (
        hovered ? <><UserMinus size={14} /> Unfollow</> : <><UserCheck size={14} /> Following</>
      ) : (
        <><UserPlus size={14} /> Follow</>
      )}
    </motion.button>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function Profile() {
  const { id } = useParams();
  const { user: loggedUser } = useAuth();

  const [user,           setUser]           = useState(null);
  const [posts,          setPosts]          = useState([]);
  const [showMenu,       setShowMenu]       = useState(false);
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedPost,   setSelectedPost]   = useState(null);
  const [visiblePosts,   setVisiblePosts]   = useState(12);
  const [followerCount,  setFollowerCount]  = useState(0);

  const loaderRef = useRef(null);
  const menuRef   = useRef(null);

  const profileId    = id === "me" ? loggedUser?._id : id;
  const isOwnProfile = loggedUser?._id === profileId;

  const isFollowing = user?.followers?.some(
    (f) => (f._id || f).toString() === loggedUser?._id?.toString()
  ) ?? false;

  // Fetch profile + posts
  useEffect(() => {
    if (!profileId) return;
    (async () => {
      try {
        const [userRes, postsRes] = await Promise.all([
          API.get(`/users/${profileId}`),
          API.get("/posts/feed"),
        ]);
        setUser(userRes.data);
        setFollowerCount(userRes.data.followers?.length || 0);
        setPosts(postsRes.data.posts.filter((p) => p.user._id === profileId));
      } catch (err) { console.error(err); }
    })();
  }, [profileId]);

  // Close settings dropdown on outside click
  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisiblePosts((p) => p + 6);
    });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    try { await API.post("/auth/logout"); window.location.href = "/login"; }
    catch (err) { console.error(err); }
  };

  // ── Delete post directly from grid ──────────────────────────────────────
  const handleDeletePost = async (postId, e) => {
    e.stopPropagation(); // don't open modal
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await API.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      if (selectedPost?._id === postId) setSelectedPost(null);
    } catch (err) {
      console.error("Delete post error:", err);
    }
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-500/30">
      <StarBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">

        {/* ── Profile header card ── */}
        <div className="relative overflow-hidden bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 mb-12">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-500" />
              <img
                src={user.avatar || "https://via.placeholder.com/150"}
                className="relative w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-2 border-zinc-900"
                alt={user.name}
              />
            </div>

            <div className="flex-1 text-center md:text-left">
              {/* Username + actions row */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <h2 className="text-3xl font-black tracking-tighter text-white">{user.username}</h2>

                <div className="flex items-center justify-center md:justify-start gap-2">
                  {!isOwnProfile ? (
                    <>
                      <FollowButton
                        profileId={profileId}
                        initialFollowing={isFollowing}
                        onFollowChange={(_, count) => setFollowerCount(count)}
                      />
                      <Link
                        to={`/chat/${profileId}`}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-all"
                        title="Send message"
                      >
                        <MessageCircle size={20} />
                      </Link>
                    </>
                  ) : (
                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-all"
                      >
                        <Settings size={20} />
                      </button>
                      <AnimatePresence>
                        {showMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-3 w-48 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
                          >
                            <button
                              onClick={() => { setShowEditModal(true); setShowMenu(false); }}
                              className="w-full px-5 py-3.5 hover:bg-white/5 flex items-center gap-3 text-sm font-medium transition-colors"
                            >
                              <UserCircle size={18} className="text-purple-400" /> Edit Profile
                            </button>
                            <button
                              onClick={handleLogout}
                              className="w-full px-5 py-3.5 hover:bg-red-500/10 text-red-400 flex items-center gap-3 text-sm font-medium transition-colors border-t border-white/5"
                            >
                              <LogOut size={18} /> Logout
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex justify-center md:justify-start gap-8 mb-6">
                {[
                  { value: posts.length, label: "Posts" },
                  { value: followerCount, label: "Followers", animated: true },
                  { value: user.following?.length || 0, label: "Following" },
                ].map(({ value, label, animated }) => (
                  <div key={label} className="text-center md:text-left">
                    {animated ? (
                      <motion.div
                        key={value}
                        initial={{ y: -5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-xl font-bold text-white"
                      >
                        {value}
                      </motion.div>
                    ) : (
                      <div className="text-xl font-bold text-white">{value}</div>
                    )}
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</div>
                  </div>
                ))}
              </div>

              {/* Bio */}
              <div>
                <p className="font-bold text-white mb-1">{user.name}</p>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
                  {user.bio || "No bio yet."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-[1px] bg-purple-500" />
            <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Gallery</span>
          </div>
          {isOwnProfile && (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreatePost(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:bg-zinc-100 transition-colors"
            >
              <ImageIcon size={14} /> New Post
            </motion.button>
          )}
        </div>

        {/* ── Posts grid ── */}
        {posts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-zinc-900/20 border border-dashed border-white/5 rounded-3xl gap-4">
            <Grid className="text-zinc-800" size={48} />
            <p className="text-zinc-500 font-medium text-sm">
              {isOwnProfile ? "No posts yet. Share your first moment." : "No posts yet."}
            </p>
            {isOwnProfile && (
              <button
                onClick={() => setShowCreatePost(true)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
              >
                Create first post
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {posts.slice(0, visiblePosts).map((post) => (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative aspect-square group cursor-pointer overflow-hidden rounded-2xl bg-zinc-900"
                onClick={() => setSelectedPost(post)}
              >
                {/* Image */}
                <LazyImage
                  src={post.image}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Hover overlay — stats */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center gap-5 pointer-events-none">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5 text-white font-bold text-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    {post.likes?.length || 0}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5 text-white font-bold text-sm">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    {post.comments?.length || 0}
                  </span>
                </div>

                {/* Delete button — own profile only, top-right corner */}
                {isOwnProfile && (
                  <button
                    onClick={(e) => handleDeletePost(post._id, e)}
                    title="Delete post"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm
                      flex items-center justify-center text-white
                      opacity-0 group-hover:opacity-100
                      hover:bg-red-500 transition-all duration-200 z-10 pointer-events-auto"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <div ref={loaderRef} className="h-20" />
      </div>

      {/* ── Modals ── */}
      <PostModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onDeleted={(postId) => {
          setPosts((prev) => prev.filter((p) => p._id !== postId));
          setSelectedPost(null);
        }}
        onUpdated={(updatedPost) => {
          setPosts((prev) => prev.map((p) => p._id === updatedPost._id ? updatedPost : p));
          setSelectedPost(updatedPost);
        }}
      />

      <AnimatePresence>
        {showCreatePost && (
          <CreatePostModal
            onClose={() => setShowCreatePost(false)}
            onPosted={(newPost) => {
              setPosts((prev) => [newPost, ...prev]);
              setShowCreatePost(false);
            }}
          />
        )}
      </AnimatePresence>

      {showEditModal && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updated) => {
            setUser(updated);
            setFollowerCount(updated.followers?.length || 0);
          }}
        />
      )}
    </div>
  );
}

export default Profile;