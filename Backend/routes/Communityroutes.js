import express from "express";
import protect from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";
import {
  createCommunity,
  exploreCommunities,
  getMyCommunities,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  sendMessage,
  sendCommunityPoll,
  voteCommunityPoll,
  updateSettings,
  deleteCommunity,
} from "../controllers/communityController.js";

const router = express.Router();

router.get("/",                       protect, exploreCommunities);
router.get("/mine",                   protect, getMyCommunities);
router.get("/:id",                    protect, getCommunity);
router.post("/",                      protect, upload.single("avatar"), createCommunity);
router.post("/:id/join",              protect, joinCommunity);
router.post("/:id/leave",             protect, leaveCommunity);
router.post("/:id/message",           protect, upload.single("image"), sendMessage);
router.post("/:id/poll",              protect, sendCommunityPoll);
router.post("/:id/poll/:msgId/vote",  protect, voteCommunityPoll);
router.patch("/:id/settings",         protect, upload.single("avatar"), updateSettings);
router.delete("/:id",                 protect, deleteCommunity);

export default router;