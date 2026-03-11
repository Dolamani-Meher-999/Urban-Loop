import express from "express";
import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import cloudinary from "../config/cloudinary.js";
import User from "../models/User.js";

const router = express.Router();

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

    const user = await User.findById(req.params.id)
      .select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);

  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   UPDATE PROFILE + AVATAR
========================= */
router.put(
  "/me",
  protect,
  upload.single("avatar"),
  async (req, res) => {
    try {

      const user = req.user;

      user.name = req.body.name || user.name;
      user.username = req.body.username || user.username;
      user.bio = req.body.bio || user.bio;
      user.city = req.body.city || user.city;

      if (req.file) {

        if (user.avatar) {
          const publicId = user.avatar
            .split("/")
            .slice(-1)[0]
            .split(".")[0];

          await cloudinary.uploader.destroy(`avatars/${publicId}`);
        }

        const result = await new Promise((resolve, reject) => {

          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "avatars",
              transformation: [
                { width: 300, height: 300, crop: "fill" }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
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
  }
);

export default router;