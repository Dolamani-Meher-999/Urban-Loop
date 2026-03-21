import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";

function ChatPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    if (!userId) { setSelectedChat(null); return; }
    const openChat = async () => {
      try {
        setLoadingChat(true);
        const res = await API.post("/chat/create", { userId });
        setSelectedChat(res.data);
      } catch (err) {
        console.error("Chat open error:", err);
      } finally {
        setLoadingChat(false);
      }
    };
    openChat();
  }, [userId]);

  const handleChatDeleted = useCallback((chatId) => {
    if (selectedChat?._id === chatId) {
      setSelectedChat(null);
      if (userId) navigate("/chat", { replace: true });
    }
  }, [selectedChat, userId, navigate]);

  return (
    <div 
      className="flex overflow-hidden bg-[#09090b] text-zinc-100 relative"
      style={{ flex: "1 1 0", minHeight: 0 }}
    >
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full" />
      </div>

      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-80 lg:w-96 flex-shrink-0 flex flex-col overflow-hidden border-r border-white/[0.06] z-10 backdrop-blur-sm bg-black/10"
      >
        <ChatSidebar
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?._id}
          onChatDeleted={handleChatDeleted}
        />
      </motion.aside>

      <main className="relative overflow-hidden z-10 flex-1 min-w-0 bg-black/20">
        <AnimatePresence mode="wait">
          {loadingChat ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-6"
            >
              <div className="relative">
                <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                <div className="absolute inset-0 blur-md bg-purple-500/20 rounded-full animate-pulse" />
              </div>
              <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase animate-pulse">Initializing Secure Channel</p>
            </motion.div>
          ) : selectedChat ? (
            <motion.div
              key={selectedChat._id}
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <ChatWindow chat={selectedChat} onDeleteChat={handleChatDeleted} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-8"
            >
              <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full scale-150 group-hover:bg-purple-500/30 transition-colors duration-500" />
                <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl">
                   <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                   </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
                Encrypted Space
              </h2>
              <p className="text-zinc-500 mt-3 max-w-[280px] text-sm leading-relaxed font-medium">
                Select a protocol to begin transmission.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default ChatPage;