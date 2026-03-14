import { useEffect, useState } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import socket from "../socket";

function ChatSidebar({ onSelectChat }) {

  const { user } = useAuth();

  const [chats, setChats] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // FETCH CHATS
  const fetchChats = async () => {

    try {

      const res = await API.get("/chat");

      setChats(res.data);

    } catch (err) {
      console.log(err);
    }

  };

  useEffect(() => {
    fetchChats();
  }, []);

  // ONLINE USERS
  useEffect(() => {

    socket.on("online-users", (users) => {

      setOnlineUsers(users);

    });

    return () => socket.off("online-users");

  }, []);

  // NEW MESSAGE UPDATE
  useEffect(() => {

    socket.on("receive-message", () => {

      fetchChats(); // refresh chat list

    });

    return () => socket.off("receive-message");

  }, []);

  return (
    <div className="w-80 border-r border-zinc-800 bg-zinc-950 overflow-y-auto">

      <div className="p-4 text-lg font-semibold border-b border-zinc-800">
        Messages
      </div>

      {chats.map((chat) => {

        const otherUser = chat.participants.find(
          (p) => p._id !== user._id
        );

        if (!otherUser) return null;

        const isOnline = onlineUsers.includes(otherUser._id);

        return (
          <div
            key={chat._id}
            onClick={() => onSelectChat(chat)}
            className="flex items-center justify-between p-4 hover:bg-zinc-900 cursor-pointer border-b border-zinc-800"
          >

            <div className="flex items-center gap-3">

              <div className="relative">

                <img
                  src={otherUser.avatar || "/avatar.png"}
                  className="w-10 h-10 rounded-full"
                />

                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-zinc-900"></span>
                )}

              </div>

              <div>
                <p className="font-medium">{otherUser.name}</p>
                <p className="text-xs text-zinc-400">
                  {isOnline ? "Online" : "Offline"}
                </p>
              </div>

            </div>

            {chat.unreadCount > 0 && (
              <span className="bg-purple-600 text-xs px-2 py-1 rounded-full">
                {chat.unreadCount}
              </span>
            )}

          </div>
        );
      })}

    </div>
  );
}

export default ChatSidebar;