import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getMyProfile,
  getUserProfile,
  followUser,
  unfollowUser,
  updateProfile
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.get("/:id", protect, getUserProfile);
router.put("/follow/:id", protect, followUser);
router.put("/unfollow/:id", protect, unfollowUser);
router.put("/me", protect, updateProfile);

export default router;