import express from "express";
import crypto from "crypto";
import protect from "../middleware/authMiddleware.js";
import CallLog from "../models/CallLog.js";

const router = express.Router();

// ── GET /api/calls/ice-servers ─────────────────────────────────────────────
// Returns dynamic short-lived TURN credentials (HMAC method)
// coturn must be configured with static-auth-secret matching TURN_SECRET env var
router.get("/ice-servers", protect, (req, res) => {
  const ttl       = 86400; // 24 hours
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const username  = `${timestamp}:${req.user._id}`;
  const secret    = process.env.TURN_SECRET || "dev-turn-secret";
  const credential = crypto
    .createHmac("sha1", secret)
    .update(username)
    .digest("base64");

  const turnHost = process.env.TURN_HOST || "localhost";

  res.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // Add your coturn server when deployed:
      // { urls: `stun:${turnHost}:3478` },
      // { urls: `turn:${turnHost}:3478`, username, credential },
      // { urls: `turns:${turnHost}:5349`, username, credential },
    ],
  });
});

// ── GET /api/calls/history ──────────────────────────────────────────────────
// Returns call history for the logged-in user
router.get("/history", protect, async (req, res) => {
  try {
    const logs = await CallLog.find({
      "participants.user": req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("initiator", "name username avatar")
      .populate("participants.user", "name username avatar")
      .populate("chatId", "isGroup groupName participants");

    res.json(logs);
  } catch (err) {
    console.error("Call history error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/calls/log ─────────────────────────────────────────────────────
// Create a call log entry when a call starts
router.post("/log", protect, async (req, res) => {
  try {
    const { roomId, type, callType, chatId, participantIds } = req.body;

    const participants = (participantIds || []).map((uid) => ({
      user:   uid,
      status: uid === req.user._id.toString() ? "joined" : "no-answer",
    }));

    const log = await CallLog.create({
      roomId,
      type,
      callType,
      chatId,
      initiator: req.user._id,
      participants,
      startedAt: new Date(),
      status: "ongoing",
    });

    res.status(201).json(log);
  } catch (err) {
    console.error("Call log create error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/calls/log/:roomId/end ───────────────────────────────────────
router.patch("/log/:roomId/end", protect, async (req, res) => {
  try {
    const log = await CallLog.findOne({ roomId: req.params.roomId });
    if (!log) return res.status(404).json({ message: "Call log not found" });

    const endedAt = new Date();
    const duration = log.startedAt
      ? Math.floor((endedAt - log.startedAt) / 1000)
      : 0;

    log.endedAt  = endedAt;
    log.duration = duration;
    log.status   = "ended";
    await log.save();

    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/calls/log/:roomId/participant ────────────────────────────────
// Update a participant's status (joined, missed, rejected)
router.patch("/log/:roomId/participant", protect, async (req, res) => {
  try {
    const { status, joinedAt, leftAt } = req.body;
    const log = await CallLog.findOne({ roomId: req.params.roomId });
    if (!log) return res.status(404).json({ message: "Call log not found" });

    const p = log.participants.find(
      (p) => p.user.toString() === req.user._id.toString()
    );
    if (p) {
      if (status)   p.status   = status;
      if (joinedAt) p.joinedAt = joinedAt;
      if (leftAt)   p.leftAt   = leftAt;
    }
    await log.save();
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;