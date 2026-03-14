import express from "express";
import protect from "../middleware/authMiddleware.js";

import {
  sendMessage,
  getMessages,
  getUnreadCount,
  markMessagesRead
} from "../controllers/messageController.js";

const router = express.Router();

router.post("/", protect, sendMessage);

router.get("/:chatId", protect, getMessages);

// ⭐ NEW
router.get("/unread/count", protect, getUnreadCount);
router.put("/read/:chatId", protect, markMessagesRead);

export default router;