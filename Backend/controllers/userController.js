import User from "../models/User.js";

export const getMyProfile = async (req, res) => {
  const user = await User.findById(req.user._id).populate(
    "followers following",
    "name username avatar"
  );

  res.json(user);
};

export const getUserProfile = async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user);
};

export const followUser = async (req, res) => {
  const userToFollow = await User.findById(req.params.id);
  const currentUser = await User.findById(req.user._id);

  if (!userToFollow) {
    return res.status(404).json({ message: "User not found" });
  }

  if (currentUser.following.includes(userToFollow._id)) {
    return res.status(400).json({ message: "Already following" });
  }

  currentUser.following.push(userToFollow._id);
  userToFollow.followers.push(currentUser._id);

  await currentUser.save();
  await userToFollow.save();

  res.json({ message: "User followed successfully" });
};

export const unfollowUser = async (req, res) => {
  const userToUnfollow = await User.findById(req.params.id);
  const currentUser = await User.findById(req.user._id);

  currentUser.following =
    currentUser.following.filter(
      id => id.toString() !== req.params.id
    );

  userToUnfollow.followers =
    userToUnfollow.followers.filter(
      id => id.toString() !== req.user._id.toString()
    );

  await currentUser.save();
  await userToUnfollow.save();

  res.json({ message: "User unfollowed" });
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = req.body.name || user.name;
    user.username = req.body.username || user.username;
    user.bio = req.body.bio || user.bio;
    user.city = req.body.city || user.city;

    // avatar update (optional)
    if (req.body.avatar) {
      user.avatar = req.body.avatar;
    }

    const updatedUser = await user.save();

    res.json(updatedUser);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Profile update failed" });
  }
};