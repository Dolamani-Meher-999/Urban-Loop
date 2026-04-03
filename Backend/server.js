import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db.js";

import authRoutes      from "./routes/authRoutes.js";
import userRoutes      from "./routes/userRoutes.js";
import postRoutes      from "./routes/postRoutes.js";
import chatRoutes      from "./routes/chatRoutes.js";
import messageRoutes   from "./routes/messageRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import callRoutes      from "./routes/callRoutes.js";
import exploreRoutes   from "./routes/exploreRoutes.js";   // ← ADDED

import { initSocket } from "./socket/socket.js";

connectDB();

const app = express();
const server = http.createServer(app);

// ── Socket ─────────────────────────────────────────────────
const io = initSocket(server);
app.set("io", io);

// ── Core middleware ────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

// ── Rate limiting ──────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: "Slow down — too many messages." },
});

app.use("/api/", apiLimiter);
app.use("/api/messages", messageLimiter);

// ── Routes ─────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/posts",     postRoutes);
app.use("/api/chat",      chatRoutes);
app.use("/api/messages",  messageRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/calls",     callRoutes);
app.use("/api/explore",   exploreRoutes);   // ← ADDED

// ── Health check ───────────────────────────────────────────
app.get("/", (_req, res) => res.send("Backend API Running 🚀"));

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ message: "File too large (max 50 MB)" });
  if (err.message?.startsWith("File type"))
    return res.status(415).json({ message: err.message });
  res.status(500).json({ message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));