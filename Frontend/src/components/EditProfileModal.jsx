import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";

function EditProfileModal({ user, onClose, onUpdated }) {

  const [name, setName] = useState(user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [city, setCity] = useState(user.city || "");
  const [loading, setLoading] = useState(false);

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(user.avatar || "");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);


  const handleSave = async () => {
    try {

      setLoading(true);
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("name", name);
      formData.append("username", username);
      formData.append("bio", bio);
      formData.append("city", city);

      if (avatar) formData.append("avatar", avatar);

      const res = await API.put("/users/me", formData, {
        onUploadProgress: (progressEvent) => {

          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );

          setUploadProgress(percent);
        }
      });

      onUpdated(res.data);
      onClose();

    } catch (err) {
      console.log(err);
      alert("Profile update failed");

    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };


  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >

        <motion.div
          className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md"
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.85 }}
          onClick={(e) => e.stopPropagation()}
        >

          <h2 className="text-xl font-bold text-white mb-5">
            Edit Profile
          </h2>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-4">

            <img
              src={preview || "/default-avatar.png"}
              alt="avatar"
              className="w-28 h-28 rounded-full object-cover border-2 border-purple-500 shadow-lg"
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {

                const file = e.target.files[0];
                if (!file) return;

                setAvatar(file);
                setPreview(URL.createObjectURL(file));

              }}
              className="text-sm text-zinc-400"
            />

          </div>

          {/* Upload Progress */}
          {isUploading && (
            <p className="text-purple-400 text-sm text-center mb-3">
              Uploading {uploadProgress}%
            </p>
          )}

          {/* Inputs */}
          <div className="space-y-3">

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full bg-zinc-800 p-2 rounded-lg text-white"
            />

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-zinc-800 p-2 rounded-lg text-white"
            />

            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="w-full bg-zinc-800 p-2 rounded-lg text-white"
            />

            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio"
              rows={3}
              className="w-full bg-zinc-800 p-2 rounded-lg text-white"
            />

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-5">

            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-700 rounded-lg"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              {loading ? "Saving..." : "Save"}
            </button>

          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default EditProfileModal;