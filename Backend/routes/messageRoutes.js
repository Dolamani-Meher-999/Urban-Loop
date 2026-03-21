import express from "express";
import protect from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";

import {
  sendMessage,
  getMessages,
  getUnreadCount,
  markMessagesRead,
  editMessage,
  deleteMessage,
  reactToMessage,
  sendPoll,
  votePoll,
  forwardMessage,
} from "../controllers/messageController.js";

const router = express.Router();

router.post("/",                    protect, upload.single("file"), sendMessage);
router.post("/poll",                protect, sendPoll);
router.post("/forward",             protect, forwardMessage);
router.post("/:messageId/vote",     protect, votePoll);
router.get("/:chatId",              protect, getMessages);
router.get("/unread/count",         protect, getUnreadCount);
router.put("/read/:chatId",         protect, markMessagesRead);
router.put("/:messageId",           protect, editMessage);
router.delete("/:messageId",        protect, deleteMessage);
router.post("/:messageId/react",    protect, reactToMessage);

export default router;