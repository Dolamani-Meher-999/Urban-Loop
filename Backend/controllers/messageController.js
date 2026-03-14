import Message from "../models/Message.js";
import Chat from "../models/Chat.js";

export const sendMessage = async (req, res) => {
  try {

    const { chatId, text } = req.body;

    const message = await Message.create({
      chat: chatId,
      sender: req.user.id,
      text
    });

    const chat = await Chat.findById(chatId);

    const receiver = chat.participants.find(
      (id) => id.toString() !== req.user.id
    );

    // update last message
    chat.lastMessage = message._id;
    await chat.save();

    // ⭐ EMIT EVENT FOR NAVBAR BADGE
    const io = req.app.get("io");

    io.to(receiver.toString()).emit("new-message-notification", {
      chatId,
      message
    });

    res.json(message);

  } catch (err) {
    res.status(500).json({ message: "Message sending failed" });
  }
};


export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      chat: req.params.chatId,
    })
      .populate("sender", "name avatar")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to load messages" });
  }
};

// ================= UNREAD COUNT =================

export const getUnreadCount = async (req, res) => {
  try {

    const count = await Message.countDocuments({
      receiver: req.user.id,
      seen: false
    });

    res.json({ count });

  } catch (err) {
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};


// ================= MARK AS READ =================

export const markMessagesRead = async (req, res) => {
  try {

    const { chatId } = req.params;

    await Message.updateMany(
      {
        chat: chatId,
        receiver: req.user.id,
        seen: false
      },
      {
        seen: true
      }
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: "Failed to update messages" });
  }
};