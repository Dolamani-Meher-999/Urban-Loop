import express from "express";
import protect from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";
import {
  createPost,
  getPosts,
  deletePost,
  likePost,
  addComment,
  getFeedPosts,
} from "../controllers/postController.js";

const router = express.Router();

// upload.single("image") parses multipart/form-data and puts the file
// on req.file — postController.createPost then uploads it to Cloudinary
router.post("/",          protect, upload.single("image"), createPost);
router.get("/",           protect, getPosts);
router.get("/feed",       protect, getFeedPosts);
router.delete("/:id",     protect, deletePost);
router.put("/like/:id",   protect, likePost);
router.post("/comment/:id", protect, addComment);

export default router;