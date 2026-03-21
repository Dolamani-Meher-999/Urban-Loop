import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

// ─────────────────────────────────────────────
// POST /api/chat/create  — 1-to-1
// ─────────────────────────────────────────────
export const getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId === req.user.id)
      return res.status(400).json({ message: "Cannot chat with yourself" });

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [req.user.id, userId], $size: 2 },
    })
      .populate("participants", "name avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name avatar" },
      });

    if (!chat) {
      chat = await Chat.create({
        participants: [req.user.id, userId],
        isGroup: false,
      });
      chat = await chat
        .populate("participants", "name avatar");
    }

    res.json(chat);
  } catch (err) {
    console.error("getOrCreateChat:", err);
    res.status(500).json({ message: "Chat creation failed" });
  }
};

// ─────────────────────────────────────────────
// POST /api/chat/group  — group chat
// ─────────────────────────────────────────────
export const createGroupChat = async (req, res) => {
  try {
    const { name, userIds } = req.body;

    if (!name) return res.status(400).json({ message: "Group name required" });
    if (!userIds || userIds.length < 2)
      return res.status(400).json({ message: "Need at least 2 other users" });

    const participants = [...new Set([req.user.id, ...userIds])];

    const chat = await Chat.create({
      participants,
      isGroup: true,
      groupName: name,
      groupAdmin: req.user.id,
    });

    const populated = await chat.populate("participants", "name avatar");
    res.status(201).json(populated);
  } catch (err) {
    console.error("createGroupChat:", err);
    res.status(500).json({ message: "Group creation failed" });
  }
};

// ─────────────────────────────────────────────
// GET /api/chat  — sidebar list
// ─────────────────────────────────────────────
export const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .populate("participants", "name avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name avatar" },
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Attach unread counts per chat
    const chatIds = chats.map((c) => c._id);

    const unreadAgg = await Message.aggregate([
      {
        $match: {
          chat: { $in: chatIds },
          sender: { $ne: req.user._id },
          seenBy: { $nin: [req.user._id] },
          deletedForEveryone: { $ne: true },
          deletedFor: { $nin: [req.user._id] },
        },
      },
      { $group: { _id: "$chat", count: { $sum: 1 } } },
    ]);

    const unreadMap = {};
    unreadAgg.forEach((r) => {
      unreadMap[r._id.toString()] = r.count;
    });

    const result = chats.map((c) => ({
      ...c,
      unreadCount: unreadMap[c._id.toString()] || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("getUserChats:", err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/chat/:chatId
// ─────────────────────────────────────────────
export const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    const isMember = chat.participants
      .map((p) => p.toString())
      .includes(req.user.id);
    if (!isMember) return res.status(403).json({ message: "Not a participant" });

    // Delete all messages in this chat, then the chat itself
    await Message.deleteMany({ chat: chat._id });
    await chat.deleteOne();

    // Notify other participants
    const io = req.app.get("io");
    chat.participants.forEach((pid) => {
      if (pid.toString() !== req.user.id) {
        io.to(pid.toString()).emit("chat-deleted", { chatId: chat._id });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("deleteChat:", err);
    res.status(500).json({ message: "Delete failed" });
  }
};