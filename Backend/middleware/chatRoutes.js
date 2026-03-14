import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getOrCreateChat,
  getUserChats,
} from "../controllers/chatController.js";

const router = express.Router();

router.post("/create", protect, getOrCreateChat);
router.get("/", protect, getUserChats);

export default router;