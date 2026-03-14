import Chat from "../models/Chat.js";

export const createChat = async (req, res) => {
  try {
    const { userId } = req.body;

    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, userId] },
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [req.user.id, userId],
      });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: "Chat creation failed" });
  }
};


export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id,
    })
      .populate("participants", "name avatar")
      .populate("lastMessage");

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};