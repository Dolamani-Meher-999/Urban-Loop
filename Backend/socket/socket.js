import { Server } from "socket.io";
import Message from "../models/Message.js";

const onlineUsers = new Map(); // userId → socketId

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ Socket connected:", socket.id);

    // ── Online presence ────────────────────────────────────
    socket.on("user-online", (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.join(userId); // personal room for DM notifications
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });

    // ── Join / leave a 1-to-1 or group chat room ──────────
    socket.on("join-chat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("leave-chat", (chatId) => {
      socket.leave(chatId);
    });

    // ── Community rooms ────────────────────────────────────
    socket.on("join-community", (communityId) => {
      socket.join(`community:${communityId}`);
    });

    socket.on("leave-community", (communityId) => {
      socket.leave(`community:${communityId}`);
    });

    // ── Typing indicators ──────────────────────────────────
    socket.on("typing", ({ chatId, userId }) => {
      socket.to(chatId).emit("user-typing", { chatId, userId });
    });

    socket.on("stop-typing", ({ chatId, userId }) => {
      socket.to(chatId).emit("stop-typing", { chatId, userId });
    });

    // ── Seen (via socket, not REST) ────────────────────────
    // REST route is the primary path; this is for instant UX feedback
    socket.on("seen-message", async ({ chatId, userId }) => {
      try {
        await Message.updateMany(
          {
            chat: chatId,
            sender: { $ne: userId },
            seenBy: { $nin: [userId] },
          },
          { $addToSet: { seenBy: userId } }
        );
        io.to(chatId).emit("messages-read", { chatId, readBy: userId });
      } catch (err) {
        console.error("seen-message socket error:", err);
      }
    });

    // ── Reaction (persisted via REST /react — socket is just for
    //    real-time broadcast after the REST call succeeds) ──
    // Frontend should call REST, which then emits "reaction-updated".
    // Keep this event as a fallback / optimistic path:
    socket.on("react-message", async ({ chatId, messageId, emoji, userId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIdx = message.reactions.findIndex(
          (r) => r.user.toString() === userId && r.emoji === emoji
        );
        if (existingIdx > -1) {
          message.reactions.splice(existingIdx, 1);
        } else {
          message.reactions = message.reactions.filter(
            (r) => r.user.toString() !== userId
          );
          message.reactions.push({ user: userId, emoji });
        }
        await message.save();

        io.to(chatId).emit("reaction-updated", {
          messageId,
          reactions: message.reactions,
        });
      } catch (err) {
        console.error("react-message socket error:", err);
      }
    });

    // ── Disconnect ─────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);

      for (const [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);
          io.emit("online-users", Array.from(onlineUsers.keys()));
          break;
        }
      }
    });
  });

  return io;
};