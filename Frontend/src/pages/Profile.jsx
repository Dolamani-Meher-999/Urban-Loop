import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Settings, LogOut, UserCircle } from "lucide-react";

import API from "../services/api";
import StarBackground from "../components/StarBackground";
import { useAuth } from "../context/AuthContext";
import LazyImage from "../components/LazyImage";
import PostModal from "../components/PostModal";
import EditProfileModal from "../components/EditProfileModal";

function Profile() {
  const { id } = useParams();
  const { user: loggedUser } = useAuth();

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);

  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedPost, setSelectedPost] = useState(null);
  const [visiblePosts, setVisiblePosts] = useState(12);

  const loaderRef = useRef(null);
  const menuRef = useRef(null);

  const profileId = id === "me" ? loggedUser?._id : id;
  const isOwnProfile = loggedUser?._id === profileId;

  // fetch profile
  useEffect(() => {
    if (!profileId) return;

    const fetchProfile = async () => {
      try {
        const userRes = await API.get(`/users/${profileId}`);
        setUser(userRes.data);

        const postsRes = await API.get("/posts/feed");
        setPosts(
          postsRes.data.posts.filter(
            (post) => post.user._id === profileId
          )
        );
      } catch (err) {
        console.log("Fetch Error:", err);
      }
    };

    fetchProfile();
  }, [profileId]);

  // close menu
  useEffect(() => {
    const click = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  // infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting)
        setVisiblePosts((p) => p + 6);
    });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    try {
      await API.post("/auth/logout");
      window.location.href = "/login";
    } catch (err) {
      console.log("Logout Error:", err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <StarBackground />

      <div className="relative z-10 max-w-5xl mx-auto p-6">

        {/* HEADER */}
        <div className="bg-zinc-900/70 border border-zinc-700 rounded-2xl p-6">
          <div className="flex gap-6 items-center">

            <img
              src={user.avatar || "https://via.placeholder.com/120"}
              className="w-28 h-28 rounded-full object-cover"
            />

            <div className="flex-1">

              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{user.username}</h2>

                {isOwnProfile && (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 hover:bg-zinc-800 rounded-full"
                    >
                      <Settings size={20} />
                    </button>

                    {showMenu && (
                      <div className="absolute mt-2 right-0 w-44 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">

                        <button
                          onClick={() => {
                            setShowEditModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-3 hover:bg-zinc-800 flex gap-2 items-center"
                        >
                          <UserCircle size={16} />
                          Edit Profile
                        </button>

                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-3 hover:bg-red-600/20 text-red-400 flex gap-2 items-center"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-6 mt-3 text-sm text-zinc-300">
                <span><b>{posts.length}</b> posts</span>
                <span><b>{user.followers?.length || 0}</b> followers</span>
                <span><b>{user.following?.length || 0}</b> following</span>
              </div>

              <p className="mt-3 font-semibold">{user.name}</p>
              <p className="text-zinc-400">{user.bio}</p>
            </div>
          </div>
        </div>

        {/* POSTS */}
        <div className="mt-8 columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {posts.slice(0, visiblePosts).map((post) => (
            <div key={post._id} className="break-inside-avoid">
              <LazyImage
                src={post.image}
                onClick={() => setSelectedPost(post)}
              />
            </div>
          ))}
        </div>

        <div ref={loaderRef} className="h-10" />
      </div>

      <PostModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
      />

      {showEditModal && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditModal(false)}
          onUpdated={setUser}
        />
      )}
    </div>
  );
}

export default Profile;