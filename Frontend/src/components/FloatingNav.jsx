import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Compass, User, MessageCircle } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import API from "../services/api";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";

function FloatingNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef(null);

  const { user } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { name: "Feed", icon: Home, path: "/feed" },

    // MESSAGE CENTRE
    { name: "Messages", icon: MessageCircle, path: "/chat" },

    { name: "Explore", icon: Compass, path: "/explore" },
    { name: "Profile", icon: User, path: "/profile/me" },
  ];

  // ================= Scroll Effect =================
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ================= Fetch unread count =================
  const fetchUnread = async () => {
    try {
      const res = await API.get("/messages/unread/count");
      setUnreadCount(res.data.count);
    } catch (err) {
      console.log("Unread fetch error:", err);
    }
  };

  useEffect(() => {
    fetchUnread();
  }, []);

  // ================= REALTIME SOCKET =================
  useEffect(() => {
    if (!user) return;

    // notify backend user is online
    socket.emit("user-online", user._id);

    // ⭐ REALTIME NAV BADGE
    socket.on("new-message-notification", () => {
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off("new-message-notification");
    };
  }, [user]);

  // ================= Magnetic Hover =================
  const handleMouseMove = (e) => {
    const item = e.currentTarget;
    const rect = item.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const moveX = (x - rect.width / 2) * 0.15;
    const moveY = (y - rect.height / 2) * 0.25;

    item.style.transform = `translate(${moveX}px, ${moveY}px)`;
  };

  const resetPosition = (e) => {
    e.currentTarget.style.transform = `translate(0px,0px)`;
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        ref={navRef}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300
        ${
          scrolled
            ? "bg-zinc-900/70 backdrop-blur-2xl border border-white/20 shadow-2xl"
            : "bg-white/5 backdrop-blur-xl border border-white/10"
        }`}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 to-black/20 pointer-events-none" />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              onMouseMove={handleMouseMove}
              onMouseLeave={resetPosition}
              className="relative px-5 py-2 rounded-full text-sm font-medium"
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_20px_rgba(124,58,237,0.6)]"
                />
              )}

              <span
                className={`relative z-10 flex items-center gap-2 ${
                  isActive
                    ? "text-white"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                <div className="relative">
                  <Icon size={16} />

                  {/* 🔴 Unread Badge */}
                  {item.name === "Messages" && unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>

                {item.name}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}

export default FloatingNav;