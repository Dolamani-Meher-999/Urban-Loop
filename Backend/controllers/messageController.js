import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import { uploadToCloudinary } from "../middleware/upload.js";

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────
const emitTo = (req, room, event, payload) => {
  const io = req.app.get("io");
  io.to(room).emit(event, payload);
};

// ─────────────────────────────────────────────
// POST /api/messages
// ─────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const file = req.file; // set by multer when a file is attached

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // ── Build the message payload ──────────────────────────
    const msgData = {
      chat: chatId,
      sender: req.user.id,
      text: text || "",
      seenBy: [req.user.id], // sender has already "seen" their own message
    };

    if (file) {
      const folder = file.mimetype.startsWith("audio/")
        ? "chat/voice"
        : file.mimetype.startsWith("image/")
        ? "chat/images"
        : file.mimetype.startsWith("video/")
        ? "chat/videos"
        : "chat/files";

      const result = await uploadToCloudinary(file.buffer, { folder });

      if (file.mimetype.startsWith("audio/")) {
        msgData.voice = result.secure_url;
      } else if (file.mimetype.startsWith("image/")) {
        msgData.image = result.secure_url;
      } else {
        msgData.fileUrl = result.secure_url;
        msgData.fileType = file.mimetype;
        msgData.fileName = file.originalname;
      }
    }

    // ── Persist ────────────────────────────────────────────
    let message = await Message.create(msgData);
    message = await message.populate("sender", "name avatar");

    // update chat's lastMessage + bump updatedAt for sidebar sorting
    chat.lastMessage = message._id;
    await chat.save();

    // ── Notify participants ────────────────────────────────
    const receivers = chat.participants.filter(
      (id) => id.toString() !== req.user.id
    );

    receivers.forEach((receiverId) => {
      emitTo(req, receiverId.toString(), "new-message-notification", {
        chatId,
        message,
      });
    });

    // also broadcast into the chat room so open windows receive it
    emitTo(req, chatId, "receive-message", message);

    res.status(201).json(message);
  } catch (err) {
    console.error("sendMessage:", err);
    res.status(500).json({ message: "Message sending failed" });
  }
};

// ─────────────────────────────────────────────
// GET /api/messages/:chatId?page=1&limit=40
// ─────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      chat: req.params.chatId,
      deletedForEveryone: { $ne: true },
      deletedFor: { $nin: [req.user.id] }, // hide soft-deleted messages
    })
      .populate("sender", "name avatar")
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit)
      .lean();

    // return in chronological order to the client
    res.json(messages.reverse());
  } catch (err) {
    console.error("getMessages:", err);
    res.status(500).json({ message: "Failed to load messages" });
  }
};

// ─────────────────────────────────────────────
// GET /api/messages/unread/count
// ─────────────────────────────────────────────
export const getUnreadCount = async (req, res) => {
  try {
    // Find all chats the user belongs to
    const chats = await Chat.find({ participants: req.user.id }).select("_id");
    const chatIds = chats.map((c) => c._id);

    // Count messages NOT seen by this user AND not sent by this user
    const count = await Message.countDocuments({
      chat: { $in: chatIds },
      sender: { $ne: req.user.id },
      seenBy: { $nin: [req.user.id] },
      deletedForEveryone: { $ne: true },
      deletedFor: { $nin: [req.user.id] },
    });

    res.json({ count });
  } catch (err) {
    console.error("getUnreadCount:", err);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

// ─────────────────────────────────────────────
// PUT /api/messages/read/:chatId
// ─────────────────────────────────────────────
export const markMessagesRead = async (req, res) => {
  try {
    const { chatId } = req.params;

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user.id },
        seenBy: { $nin: [req.user.id] },
      },
      { $addToSet: { seenBy: req.user.id } }
    );

    // Notify sender(s) that messages were read
    emitTo(req, chatId, "messages-read", {
      chatId,
      readBy: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("markMessagesRead:", err);
    res.status(500).json({ message: "Failed to update messages" });
  }
};

// ─────────────────────────────────────────────
// PUT /api/messages/:messageId  — edit message text
// ─────────────────────────────────────────────
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.sender.toString() !== req.user.id)
      return res.status(403).json({ message: "Not your message" });
    if (!message.text)
      return res.status(400).json({ message: "Only text messages can be edited" });

    message.text = text;
    message.isEdited = true;
    await message.save();

    emitTo(req, message.chat.toString(), "message-edited", {
      messageId,
      text,
    });

    res.json(message);
  } catch (err) {
    console.error("editMessage:", err);
    res.status(500).json({ message: "Edit failed" });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/messages/:messageId?everyone=true
// ─────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const forEveryone = req.query.everyone === "true";

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (forEveryone) {
      if (message.sender.toString() !== req.user.id)
        return res.status(403).json({ message: "Only the sender can delete for everyone" });

      message.deletedForEveryone = true;
      message.text = "";
      message.image = undefined;
      message.voice = undefined;
      message.fileUrl = undefined;
      await message.save();

      emitTo(req, message.chat.toString(), "message-deleted", {
        messageId,
        forEveryone: true,
      });
    } else {
      // Soft delete: hide only for this user
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: req.user.id },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteMessage:", err);
    res.status(500).json({ message: "Delete failed" });
  }
};

// ─────────────────────────────────────────────
// POST /api/messages/:messageId/react
// ─────────────────────────────────────────────
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // toggle: if same user reacts with same emoji → remove it
    const existingIdx = message.reactions.findIndex(
      (r) => r.user.toString() === req.user.id && r.emoji === emoji
    );

    if (existingIdx > -1) {
      message.reactions.splice(existingIdx, 1);
    } else {
      // remove any previous reaction from this user first (one reaction per user)
      message.reactions = message.reactions.filter(
        (r) => r.user.toString() !== req.user.id
      );
      message.reactions.push({ user: req.user.id, emoji });
    }

    await message.save();

    emitTo(req, message.chat.toString(), "reaction-updated", {
      messageId,
      reactions: message.reactions,
    });

    res.json(message.reactions);
  } catch (err) {
    console.error("reactToMessage:", err);
    res.status(500).json({ message: "Reaction failed" });
  }
};

// ─────────────────────────────────────────────
// POST /api/messages/poll
// body: { chatId, question, options: string[], allowMultiple? }
// ─────────────────────────────────────────────
export const sendPoll = async (req, res) => {
  try {
    const { chatId, question, options, allowMultiple } = req.body;

    if (!chatId)            return res.status(400).json({ message: "chatId is required" });
    if (!question?.trim())  return res.status(400).json({ message: "Question is required" });
    if (!Array.isArray(options) || options.length < 2)
      return res.status(400).json({ message: "At least 2 options are required" });
    if (options.length > 12)
      return res.status(400).json({ message: "Maximum 12 options allowed" });

    const message = await Message.create({
      chat:   chatId,
      sender: req.user._id,
      text:   "",
      poll: {
        question:      question.trim(),
        options:       options.map((o) => ({ text: o.trim(), votes: [] })),
        allowMultiple: allowMultiple === true,
        isClosed:      false,
      },
    });

    await message.populate("sender", "name avatar username");

    emitTo(req, chatId, "receive-message", message);

    res.status(201).json(message);
  } catch (err) {
    console.error("sendPoll:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/messages/:messageId/vote
// body: { optionIndexes: number[] }  (array to support multi-select)
// ─────────────────────────────────────────────
export const votePoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { optionIndexes } = req.body;   // e.g. [0] or [1, 2]
    const userId = req.user._id.toString();

    if (!Array.isArray(optionIndexes) || optionIndexes.length === 0)
      return res.status(400).json({ message: "optionIndexes must be a non-empty array" });

    const message = await Message.findById(messageId);
    if (!message || !message.poll)
      return res.status(404).json({ message: "Poll not found" });
    if (message.poll.isClosed)
      return res.status(400).json({ message: "This poll is closed" });

    const { poll } = message;

    // Remove previous votes by this user across all options
    poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((v) => v.toString() !== userId);
    });

    // Enforce single-select if not allowMultiple
    const targets = poll.allowMultiple ? optionIndexes : [optionIndexes[0]];

    targets.forEach((idx) => {
      if (idx >= 0 && idx < poll.options.length) {
        poll.options[idx].votes.push(req.user._id);
      }
    });

    message.markModified("poll");
    await message.save();
    await message.populate("sender", "name avatar username");

    // Broadcast updated poll to entire chat room
    emitTo(req, message.chat.toString(), "poll-updated", {
      messageId: message._id,
      poll:      message.poll,
    });

    res.json(message.poll);
  } catch (err) {
    console.error("votePoll:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages/forward
// body: { messageId, chatIds: string[] }   (forward to one or many chats)
// ─────────────────────────────────────────────────────────────────────────────
export const forwardMessage = async (req, res) => {
  try {
    const { messageId, chatIds } = req.body;

    if (!messageId)                              return res.status(400).json({ message: "messageId is required" });
    if (!Array.isArray(chatIds) || chatIds.length === 0) return res.status(400).json({ message: "chatIds must be a non-empty array" });

    const original = await Message.findById(messageId).populate("sender", "name avatar");
    if (!original) return res.status(404).json({ message: "Message not found" });

    // Can only forward non-deleted messages
    if (original.deletedForEveryone) return res.status(400).json({ message: "Cannot forward a deleted message" });

    const io = req.app.get("io");
    const forwarded = [];

    for (const chatId of chatIds) {
      const msg = await Message.create({
        chat:        chatId,
        sender:      req.user._id,
        text:        original.text  || "",
        image:       original.image || undefined,
        voice:       original.voice || undefined,
        fileUrl:     original.fileUrl  || undefined,
        fileType:    original.fileType || undefined,
        fileName:    original.fileName || undefined,
        isForwarded: true,
        // Polls are intentionally NOT forwarded (votes would be meaningless in a new chat)
      });

      await msg.populate("sender", "name avatar username");

      // Emit to each chat room so recipients see it instantly
      emitTo(req, chatId, "receive-message", msg);

      forwarded.push(msg);
    }

    res.status(201).json(forwarded);
  } catch (err) {
    console.error("forwardMessage:", err);
    res.status(500).json({ message: err.message });
  }
};