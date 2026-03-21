import express from "express";
import protect from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";
import cloudinary from "../config/cloudinary.js";
import User from "../models/User.js";

const router = express.Router();

/* =========================
   GET ALL FRIENDS
   (mutual follow = you follow them AND they follow you)
   Used by group chat member picker
========================= */
router.get("/", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("following followers");

    // Convert to plain string sets for fast intersection
    const followingSet = new Set(me.following.map((id) => id.toString()));
    const followerSet  = new Set(me.followers.map((id) => id.toString()));

    // Mutual = appears in both sets
    const friendIds = [...followingSet].filter((id) => followerSet.has(id));

    if (friendIds.length === 0) return res.json([]);

    const friends = await User.find({ _id: { $in: friendIds } })
      .select("name username avatar")
      .lean();

    res.json(friends);
  } catch (err) {
    console.error("GET FRIENDS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   GET MY PROFILE
========================= */
router.get("/me", protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   GET USER BY ID
========================= */
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   FOLLOW USER
========================= */
router.put("/:id/follow", protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "You cannot follow yourself" });

    const userToFollow = await User.findById(req.params.id);
    const currentUser  = await User.findById(req.user._id);

    if (!userToFollow) return res.status(404).json({ message: "User not found" });

    if (currentUser.following.map(String).includes(req.params.id))
      return res.status(400).json({ message: "Already following" });

    currentUser.following.push(userToFollow._id);
    userToFollow.followers.push(currentUser._id);

    await currentUser.save();
    await userToFollow.save();

    res.json({
      message:         "Followed successfully",
      followersCount:  userToFollow.followers.length,
      followingCount:  currentUser.following.length,
    });
  } catch (err) {
    console.error("FOLLOW ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   UNFOLLOW USER
========================= */
router.put("/:id/unfollow", protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "You cannot unfollow yourself" });

    const userToUnfollow = await User.findById(req.params.id);
    const currentUser    = await User.findById(req.user._id);

    if (!userToUnfollow) return res.status(404).json({ message: "User not found" });

    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== req.params.id
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    await currentUser.save();
    await userToUnfollow.save();

    res.json({
      message:         "Unfollowed successfully",
      followersCount:  userToUnfollow.followers.length,
      followingCount:  currentUser.following.length,
    });
  } catch (err) {
    console.error("UNFOLLOW ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   UPDATE PROFILE + AVATAR
========================= */
router.put("/me", protect, upload.single("avatar"), async (req, res) => {
  try {
    const user = req.user;

    user.name     = req.body.name     || user.name;
    user.username = req.body.username || user.username;
    user.bio      = req.body.bio      || user.bio;
    user.city     = req.body.city     || user.city;

    if (req.file) {
      if (user.avatar) {
        const publicId = user.avatar.split("/").slice(-1)[0].split(".")[0];
        await cloudinary.uploader.destroy(`avatars/${publicId}`);
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "avatars", transformation: [{ width: 300, height: 300, crop: "fill" }] },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(req.file.buffer);
      });

      user.avatar = result.secure_url;
    }

    await user.save();
    res.json(user);
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;