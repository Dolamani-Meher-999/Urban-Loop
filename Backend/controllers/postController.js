import Post from "../models/Post.js";
import { uploadToCloudinary } from "../middleware/upload.js";

// ─── Create Post ──────────────────────────────────────────────────────────────
export const createPost = async (req, res) => {
  try {
    let imageUrl = "";

    // If a file was attached via multipart/form-data, upload to Cloudinary
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "posts",
        transformation: [
          { width: 1080, crop: "limit" }, // cap width like Instagram
          { quality: "auto:good" },
        ],
      });
      imageUrl = result.secure_url;
    } else if (req.body.image) {
      // Fallback: accept a plain URL string (existing behaviour)
      imageUrl = req.body.image;
    }

    const post = await Post.create({
      user:    req.user._id,
      caption: req.body.caption || "",
      image:   imageUrl,
      city:    req.user.city,
    });

    // Populate user so the frontend can render avatar/name immediately
    await post.populate("user", "name username avatar");

    res.status(201).json(post);
  } catch (err) {
    console.error("CREATE POST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Get All Posts ────────────────────────────────────────────────────────────
export const getPosts = async (req, res) => {
  const posts = await Post.find()
    .populate("user", "name username avatar")
    .sort({ createdAt: -1 });
  res.json(posts);
};

// ─── Delete Post ──────────────────────────────────────────────────────────────
export const deletePost = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  if (post.user.toString() !== req.user._id.toString())
    return res.status(401).json({ message: "Not authorized" });
  await post.deleteOne();
  res.json({ message: "Post deleted" });
};

// ─── Like / Unlike ────────────────────────────────────────────────────────────
export const likePost = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const alreadyLiked = post.likes.includes(req.user._id);
  if (alreadyLiked) {
    post.likes = post.likes.filter((id) => id.toString() !== req.user._id.toString());
  } else {
    post.likes.push(req.user._id);
  }

  await post.save();
  res.json({ message: alreadyLiked ? "Post unliked" : "Post liked", likesCount: post.likes.length });
};

// ─── Add Comment ──────────────────────────────────────────────────────────────
export const addComment = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  post.comments.push({ user: req.user._id, text: req.body.text });
  await post.save();
  res.json(post.comments);
};

// ─── Feed Posts ───────────────────────────────────────────────────────────────
export const getFeedPosts = async (req, res) => {
  try {
    const user  = req.user;
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 5;
    const skip  = (page - 1) * limit;

    const query = {
      $or: [
        { user: { $in: user.following } },
        { city: user.city },
      ],
    };

    const [posts, totalPosts] = await Promise.all([
      Post.find(query)
        .populate("user", "name username avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(query),
    ]);

    // Annotate each post with whether the requesting user has liked it.
    // likes[] stores ObjectIds — compare as strings to avoid type mismatch.
    const userId = req.user._id.toString();
    const annotated = posts.map((p) => ({
      ...p.toObject(),
      likedByUser: p.likes.some((id) => id.toString() === userId),
      likesCount:  p.likes.length,
    }));

    res.json({ posts: annotated, hasMore: skip + posts.length < totalPosts, page, totalPosts });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};