import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },

    // ── Group chat support ──────────────────────────────────
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: "" },
    groupAvatar: { type: String, default: "" },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 });

export default mongoose.model("Chat", chatSchema);