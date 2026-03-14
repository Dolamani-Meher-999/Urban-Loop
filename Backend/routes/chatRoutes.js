import express from "express";
import protect from "../middleware/authMiddleware.js";

import {
  createChat,
  getChats,
} from "../controllers/chatController.js";

const router = express.Router();

router.post("/create", protect, createChat);

router.get("/", protect, getChats);

export default router;