import { useEffect, useRef, useState } from "react";
import API from "../services/api";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

function ChatWindow({ chat }) {

  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState(null);

  const bottomRef = useRef();

  const otherUser = chat.participants.find(
    (p) => p._id !== user._id
  );

  // load messages
  useEffect(() => {

    if (!chat) return;

    const fetchMessages = async () => {

      const res = await API.get(`/messages/${chat._id}`);

      setMessages(res.data);

    };

    fetchMessages();

    socket.emit("join-chat", chat._id);

  }, [chat]);

  // receive message
  useEffect(() => {

    socket.on("receive-message", (msg) => {

      setMessages((prev) => [...prev, msg]);

    });

    return () => socket.off("receive-message");

  }, []);

  // typing
  useEffect(() => {

    socket.on("user-typing", (userId) => {

      if (userId !== user._id) {

        setTypingUser(true);

        setTimeout(() => setTypingUser(false), 1500);

      }

    });

    return () => socket.off("user-typing");

  }, []);

  // auto scroll
  useEffect(() => {

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  }, [messages]);

  // send message
  const sendMessage = async () => {

    if (!text.trim()) return;

    const res = await API.post("/messages", {
      chatId: chat._id,
      text,
    });

    const newMessage = res.data;

    setMessages((prev) => [...prev, newMessage]);

    socket.emit("send-message", {
      chatId: chat._id,
      ...newMessage,
    });

    setText("");

  };

  const handleTyping = (e) => {

    setText(e.target.value);

    socket.emit("typing", {
      chatId: chat._id,
      userId: user._id,
    });

  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-950">

      {/* HEADER */}

      <div className="p-4 border-b border-zinc-800 flex items-center gap-3">

        <img
          src={otherUser.avatar || "/avatar.png"}
          className="w-10 h-10 rounded-full"
        />

        <div>
          <p className="font-semibold">{otherUser.name}</p>
        </div>

      </div>

      {/* MESSAGES */}

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {messages.map((msg) => {

          const isMine =
            msg.sender === user._id ||
            msg.sender?._id === user._id;

          const time = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          const seen = msg.seenBy?.includes(otherUser._id);

          return (
            <motion.div
              key={msg._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >

              <div
                className={`px-4 py-2 rounded-2xl max-w-xs text-sm ${
                  isMine
                    ? "bg-purple-600 text-white rounded-br-none"
                    : "bg-zinc-800 text-zinc-200 rounded-bl-none"
                }`}
              >

                {msg.text}

                <div className="text-[10px] text-zinc-300 mt-1 text-right flex items-center gap-1 justify-end">

                  {time}

                  {isMine && seen && (
                    <span className="text-blue-400">
                      Seen
                    </span>
                  )}

                </div>

              </div>

            </motion.div>
          );
        })}

        <div ref={bottomRef}></div>

      </div>

      {/* typing indicator */}

      {typingUser && (
        <p className="text-sm text-zinc-400 px-6 pb-2">
          typing...
        </p>
      )}

      {/* INPUT */}

      <div className="p-4 border-t border-zinc-800 flex gap-3">

        <input
          value={text}
          onChange={handleTyping}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="Type message..."
          className="flex-1 bg-zinc-800 text-white rounded-full px-4 py-2 outline-none"
        />

        <button
          onClick={sendMessage}
          className="px-5 py-2 bg-purple-600 rounded-full"
        >
          Send
        </button>

      </div>

    </div>
  );
}

export default ChatWindow;