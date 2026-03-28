import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow  from "../components/ChatWindow";
import socket from "../socket";

export default function ChatPage() {
  const { userId }    = useParams();
  const navigate      = useNavigate();
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading,      setLoading]      = useState(false);

  // ── Open chat by userId param (from /chat/:userId links) ──────────────────
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    // Send recipientId — controller now accepts both userId and recipientId
    API.post("/chat/create", { recipientId: userId })
      .then((r) => {
        setSelectedChat(r.data);
        // Replace URL so back-button goes to /chat not loop
        navigate("/chat", { replace: true });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── "Call Again" from history — find or create the chat then start call ───
  const handleCallAgain = useCallback((log) => {
    if (!log.chatId) return;
    const chatId = log.chatId?._id || log.chatId;
    // Build a minimal chat object if we have the info
    if (log.chatId && typeof log.chatId === "object") {
      setSelectedChat(log.chatId);
    } else {
      // Fetch the chat from server
      API.get(`/chat/${chatId}`)
        .then((r) => setSelectedChat(r.data))
        .catch(console.error);
    }
  }, []);

  return (
    <div className="flex h-full bg-[#09090b] text-zinc-100 overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-80 xl:w-96 flex-shrink-0 border-r border-white/[0.06] bg-[#0c0c0f] flex flex-col">
        <ChatSidebar
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?._id}
          onChatDeleted={(chatId) => {
            if (selectedChat?._id === chatId) setSelectedChat(null);
          }}
          onCallAgain={handleCallAgain}
        />
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 relative min-w-0">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </motion.div>
          ) : selectedChat ? (
            <motion.div key={selectedChat._id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0">
              <ChatWindow
                chat={selectedChat}
                onDeleteChat={(chatId) => {
                  if (selectedChat?._id === chatId) setSelectedChat(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-700 select-none">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm font-medium">Select a conversation</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}