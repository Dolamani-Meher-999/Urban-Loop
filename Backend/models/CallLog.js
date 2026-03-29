import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    roomId:    { type: String, required: true, unique: true },
    type:      { type: String, enum: ["voice", "video"], required: true },
    callType:  { type: String, enum: ["direct", "group"], required: true },
    chatId:    { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    initiator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [
      {
        user:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinedAt: { type: Date },
        leftAt:   { type: Date },
        status:   { type: String, enum: ["joined", "missed", "rejected", "no-answer"], default: "joined" },
      }
    ],
    startedAt: { type: Date },
    endedAt:   { type: Date },
    duration:  { type: Number, default: 0 }, // seconds
    status:    { type: String, enum: ["ongoing", "ended", "missed"], default: "ongoing" },
  },
  { timestamps: true }
);

export default mongoose.model("CallLog", callLogSchema);