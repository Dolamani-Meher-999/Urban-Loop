import Community from "../models/Community.js";
import { uploadToCloudinary } from "../middleware/upload.js";

// ─── helpers ──────────────────────────────────────────────────────────────────
// members[] may be populated objects {_id,...} or plain ObjectIds after .populate()
// so always extract ._id if present before comparing
const toStr = (id) => (id?._id || id)?.toString();

const isOwner = (community, userId) =>
  toStr(community.owner) === userId.toString();

const isMember = (community, userId) =>
  community.members.some((m) => toStr(m) === userId.toString()) ||
  isOwner(community, userId);

// ─── Create community ─────────────────────────────────────────────────────────
export const createCommunity = async (req, res) => {
  try {
    const { name, description, isPublic, broadcastOnly } = req.body;

    if (!name?.trim())
      return res.status(400).json({ message: "Community name is required." });

    const data = {
      name:          name.trim(),
      description:   description?.trim() || "",
      city:          req.user.city,          // always tied to creator's city
      owner:         req.user._id,
      members:       [req.user._id],          // owner auto-joins
      isPublic:      isPublic !== false,      // default true
      broadcastOnly: broadcastOnly === true,  // default false
    };

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, { folder: "communities" });
      data.avatar = result.secure_url;
    }

    const community = await Community.create(data);
    await community.populate("owner", "name avatar username");

    res.status(201).json(community);
  } catch (err) {
    console.error("createCommunity:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Get public communities for the logged-in user's city ────────────────────
export const exploreCommunities = async (req, res) => {
  try {
    const city    = req.query.city || req.user.city;
    const search  = req.query.search?.trim() || "";
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(30, parseInt(req.query.limit) || 20);
    const skip    = (page - 1) * limit;

    const query = { isPublic: true, city };
    if (search) query.name = { $regex: search, $options: "i" };

    const [communities, total] = await Promise.all([
      Community.find(query)
        .populate("owner", "name avatar username")
        .select("-messages")           // don't send full message history
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Community.countDocuments(query),
    ]);

    // Annotate each community with whether the requester is already a member
    const result = communities.map((c) => ({
      ...c,
      memberCount: c.members.length,
      isMember: c.members.some((m) => m.toString() === req.user._id.toString()),
    }));

    res.json({ communities: result, total, page, hasMore: skip + result.length < total });
  } catch (err) {
    console.error("exploreCommunities:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Get communities the user has joined or owns ─────────────────────────────
export const getMyCommunities = async (req, res) => {
  try {
    const communities = await Community.find({
      $or: [{ owner: req.user._id }, { members: req.user._id }],
    })
      .populate("owner", "name avatar username")
      .select("-messages")
      .sort({ updatedAt: -1 })
      .lean();

    const result = communities.map((c) => ({
      ...c,
      memberCount: c.members.length,
      isOwner: c.owner._id.toString() === req.user._id.toString(),
    }));

    res.json(result);
  } catch (err) {
    console.error("getMyCommunities:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Get single community + paginated messages ────────────────────────────────
export const getCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate("owner", "name avatar username")
      .populate("members", "name avatar username");

    if (!community) return res.status(404).json({ message: "Community not found." });

    // Private communities are only visible to members
    if (!community.isPublic && !isMember(community, req.user._id))
      return res.status(403).json({ message: "This community is private." });

    // Paginate messages (newest last — like a chat)
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const total = community.messages.length;
    const start = Math.max(0, total - page * limit);
    const msgs  = community.messages.slice(start, start + limit);

    // Populate message senders manually (subdoc populate)
    await Community.populate(msgs, { path: "sender", select: "name avatar username" });

    res.json({
      ...community.toObject(),
      messages: msgs,
      hasMoreMessages: start > 0,
      isMember: isMember(community, req.user._id),
      isOwner:  isOwner(community, req.user._id),
    });
  } catch (err) {
    console.error("getCommunity:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Join ─────────────────────────────────────────────────────────────────────
export const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (!community.isPublic)
      return res.status(403).json({ message: "This community is private." });

    if (isMember(community, req.user._id))
      return res.status(400).json({ message: "Already a member." });

    community.members.push(req.user._id);
    await community.save();

    // Notify community room via socket
    const io = req.app.get("io");
    io.to(`community:${community._id}`).emit("community-member-joined", {
      communityId: community._id,
      user: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
    });

    res.json({ message: "Joined successfully.", memberCount: community.members.length });
  } catch (err) {
    console.error("joinCommunity:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Leave ────────────────────────────────────────────────────────────────────
export const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (isOwner(community, req.user._id))
      return res.status(400).json({ message: "Owner cannot leave. Delete the community instead." });

    community.members = community.members.filter(
      (m) => m.toString() !== req.user._id.toString()
    );
    await community.save();

    res.json({ message: "Left community.", memberCount: community.members.length });
  } catch (err) {
    console.error("leaveCommunity:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Send message ─────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (!isMember(community, req.user._id))
      return res.status(403).json({ message: "Join the community first." });

    // Broadcast-only: only owner can send
    if (community.broadcastOnly && !isOwner(community, req.user._id))
      return res.status(403).json({ message: "Only the owner can send messages in broadcast-only mode." });

    const { text } = req.body;
    let imageUrl = "";

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, { folder: "community-messages" });
      imageUrl = result.secure_url;
    }

    if (!text?.trim() && !imageUrl)
      return res.status(400).json({ message: "Message cannot be empty." });

    const message = {
      sender: req.user._id,
      text:   text?.trim() || "",
      image:  imageUrl,
    };

    community.messages.push(message);
    await community.save();

    // Get the saved message (last one) and populate sender
    const saved = community.messages[community.messages.length - 1];
    await Community.populate(saved, { path: "sender", select: "name avatar username" });

    // Broadcast to everyone in this community room
    const io = req.app.get("io");
    io.to(`community:${community._id}`).emit("community-message", {
      communityId: community._id,
      message: saved,
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("sendMessage:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Update settings (owner only) ────────────────────────────────────────────
export const updateSettings = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (!isOwner(community, req.user._id))
      return res.status(403).json({ message: "Only the owner can change settings." });

    const { name, description, isPublic, broadcastOnly } = req.body;

    if (name?.trim())        community.name          = name.trim();
    if (description != null) community.description   = description.trim();
    if (isPublic    != null) community.isPublic      = Boolean(isPublic);
    if (broadcastOnly != null) community.broadcastOnly = Boolean(broadcastOnly);

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, { folder: "communities" });
      community.avatar = result.secure_url;
    }

    await community.save();

    // Notify room of settings change
    const io = req.app.get("io");
    io.to(`community:${community._id}`).emit("community-updated", {
      communityId: community._id,
      isPublic:      community.isPublic,
      broadcastOnly: community.broadcastOnly,
      name:          community.name,
    });

    res.json(community);
  } catch (err) {
    console.error("updateSettings:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Delete community (owner only) ───────────────────────────────────────────
export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (!isOwner(community, req.user._id))
      return res.status(403).json({ message: "Only the owner can delete this community." });

    await community.deleteOne();

    const io = req.app.get("io");
    io.to(`community:${community._id}`).emit("community-deleted", { communityId: community._id });

    res.json({ message: "Community deleted." });
  } catch (err) {
    console.error("deleteCommunity:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Send poll in community ───────────────────────────────────────────────────
export const sendCommunityPoll = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });
    if (!isMember(community, req.user._id))
      return res.status(403).json({ message: "Join the community first." });
    if (community.broadcastOnly && !isOwner(community, req.user._id))
      return res.status(403).json({ message: "Only the owner can post in broadcast mode." });

    const { question, options, allowMultiple } = req.body;
    if (!question?.trim())    return res.status(400).json({ message: "Question is required." });
    if (!Array.isArray(options) || options.length < 2)
      return res.status(400).json({ message: "At least 2 options are required." });

    const message = {
      sender: req.user._id,
      text:   "",
      poll: {
        question:      question.trim(),
        options:       options.map((o) => ({ text: o.trim(), votes: [] })),
        allowMultiple: allowMultiple === true,
        isClosed:      false,
      },
    };

    community.messages.push(message);
    await community.save();

    const saved = community.messages[community.messages.length - 1];
    await Community.populate(saved, { path: "sender", select: "name avatar username" });

    const io = req.app.get("io");
    io.to(`community:${community._id}`).emit("community-message", {
      communityId: community._id,
      message: saved,
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("sendCommunityPoll:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Vote on community poll ───────────────────────────────────────────────────
export const voteCommunityPoll = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found." });
    if (!isMember(community, req.user._id))
      return res.status(403).json({ message: "Join the community to vote." });

    const msg = community.messages.id(req.params.msgId);
    if (!msg || !msg.poll) return res.status(404).json({ message: "Poll not found." });
    if (msg.poll.isClosed) return res.status(400).json({ message: "This poll is closed." });

    const { optionIndexes } = req.body;
    const userId = req.user._id.toString();

    // Clear previous votes by this user
    msg.poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((v) => v.toString() !== userId);
    });

    const targets = msg.poll.allowMultiple ? optionIndexes : [optionIndexes[0]];
    targets.forEach((idx) => {
      if (idx >= 0 && idx < msg.poll.options.length)
        msg.poll.options[idx].votes.push(req.user._id);
    });

    community.markModified("messages");
    await community.save();

    const io = req.app.get("io");
    io.to(`community:${community._id}`).emit("community-poll-updated", {
      communityId: community._id,
      messageId:   msg._id,
      poll:        msg.poll,
    });

    res.json(msg.poll);
  } catch (err) {
    console.error("voteCommunityPoll:", err);
    res.status(500).json({ message: err.message });
  }
};