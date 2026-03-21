import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getOrCreateChat,
  createGroupChat,
  getUserChats,
  deleteChat,
} from "../controllers/chatController.js";

const router = express.Router();

// 1-to-1 chat (get existing or create)
router.post("/create", protect, getOrCreateChat);

// Group chat
router.post("/group", protect, createGroupChat);

// Sidebar list (with unread counts)
router.get("/", protect, getUserChats);

// Delete entire chat + all its messages
router.delete("/:chatId", protect, deleteChat);

export default router;