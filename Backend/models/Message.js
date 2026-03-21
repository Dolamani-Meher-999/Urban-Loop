import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  emoji: String,
});

const pollOptionSchema = new mongoose.Schema({
  text:  { type: String, required: true, trim: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const pollSchema = new mongoose.Schema({
  question:      { type: String, required: true, trim: true },
  options:       [pollOptionSchema],
  allowMultiple: { type: Boolean, default: false },  // multi-select
  isClosed:      { type: Boolean, default: false },  // owner can close voting
});

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    text: { type: String, default: "" },

    // ── Media ──────────────────────────────────────────────
    image: String,
    voice: String,
    fileUrl: String,
    fileType: String,
    fileName: String,

    // ── Poll ───────────────────────────────────────────────
    poll: { type: pollSchema, default: null },

    // ── Forwarded ──────────────────────────────────────────
    isForwarded: { type: Boolean, default: false },

    // ── State ──────────────────────────────────────────────
    reactions: [reactionSchema],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isEdited: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);