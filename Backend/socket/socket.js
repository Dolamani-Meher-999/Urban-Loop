import { Server } from "socket.io";

const onlineUsers = new Map();

export const initSocket = (server) => {

  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {

    console.log("⚡ User connected:", socket.id);

    // ================= USER ONLINE =================

    socket.on("user-online", (userId) => {

  onlineUsers.set(userId, socket.id);

  // ⭐ join personal room
  socket.join(userId);

  io.emit("online-users", Array.from(onlineUsers.keys()));

});

    // ================= JOIN CHAT =================

    socket.on("join-chat", (chatId) => {

      socket.join(chatId);

      console.log("User joined chat:", chatId);

    });

    // ================= SEND MESSAGE =================

    socket.on("send-message", (data) => {

      // send to everyone except sender
      socket.to(data.chatId).emit("receive-message", data);

    });

    // ================= TYPING =================

    socket.on("typing", ({ chatId, userId }) => {

      socket.to(chatId).emit("user-typing", userId);

    });

    socket.on("stop-typing", (chatId) => {

      socket.to(chatId).emit("stop-typing");

    });

    // ================= MESSAGE REACTION =================

    socket.on("react-message", ({ chatId, messageId, emoji }) => {

      io.to(chatId).emit("reaction-updated", {
        messageId,
        emoji,
      });

    });

    // ================= SEEN MESSAGE =================

    socket.on("seen-message", ({ chatId, messageId }) => {

      io.to(chatId).emit("message-seen", messageId);

    });

    // ================= DISCONNECT =================

    socket.on("disconnect", () => {

      console.log("❌ User disconnected:", socket.id);

      for (let [userId, sockId] of onlineUsers.entries()) {

        if (sockId === socket.id) {

          onlineUsers.delete(userId);

          break;

        }

      }

      io.emit("online-users", Array.from(onlineUsers.keys()));

    });

  });

  return io;

};