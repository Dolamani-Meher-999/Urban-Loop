import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema({
  text:  { type: String, required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const messageSchema = new mongoose.Schema({
  sender:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:          { type: String, default: "" },
  image:         { type: String, default: "" },
  // Poll support
  poll: {
    question:      { type: String, default: "" },
    options:       [pollOptionSchema],
    allowMultiple: { type: Boolean, default: false },
    isClosed:      { type: Boolean, default: false },
  },
}, { timestamps: true });

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String, required: true, trim: true, maxlength: 80,
    },
    description: {
      type: String, default: "", maxlength: 500,
    },
    avatar: {
      type: String, default: "",
    },
    coverImage: {
      type: String, default: "",
    },

    // Location — used for the city-based explorer
    city: {
      type: String, required: true, index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId, ref: "User", required: true,
    },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Visibility ─────────────────────────────────────────────────────
    // true  → anyone in the same city can find & join it
    // false → invite / direct-link only
    isPublic: {
      type: Boolean, default: true,
    },

    // ── Broadcast-only mode ────────────────────────────────────────────
    // true  → only the owner can send messages (like a channel / announcement group)
    // false → all members can send messages (normal group chat)
    broadcastOnly: {
      type: Boolean, default: false,
    },

    // Embedded messages (kept lean — large communities should paginate)
    messages: [messageSchema],
  },
  { timestamps: true }
);

// Virtual: member count
communitySchema.virtual("memberCount").get(function () {
  return this.members.length;
});

communitySchema.index({ city: 1, isPublic: 1 });

export default mongoose.model("Community", communitySchema);