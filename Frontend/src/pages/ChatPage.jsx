import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";

import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";

function ChatPage() {

  const { userId } = useParams();

  const [selectedChat, setSelectedChat] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  // OPEN CHAT ONLY IF userId EXISTS
  useEffect(() => {

    const openChat = async () => {

      if (!userId) {
        setSelectedChat(null);
        return;
      }

      try {

        setLoadingChat(true);

        const res = await API.post("/chat/create", {
          userId,
        });

        setSelectedChat(res.data);

      } catch (err) {
        console.log("Chat open error:", err);
      } finally {
        setLoadingChat(false);
      }

    };

    openChat();

  }, [userId]);

  return (
    <div className="flex h-screen bg-zinc-950 text-white">

      {/* SIDEBAR */}
      <ChatSidebar onSelectChat={setSelectedChat} />

      {/* CHAT WINDOW */}

      {loadingChat ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          Loading chat...
        </div>
      ) : selectedChat ? (
        <ChatWindow chat={selectedChat} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-lg">
          Select a chat to start messaging
        </div>
      )}

    </div>
  );
}

export default ChatPage;