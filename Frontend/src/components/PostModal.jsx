import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

function PostModal({ post, onClose }) {
  // close modal with ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {post && (
        <motion.div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white hover:text-gray-300"
          >
            <X size={28} />
          </button>

          <motion.div
            className="bg-zinc-900 rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl"
            initial={{ scale: 0.85, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 40 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* IMAGE */}
            {post.image && (
              <div className="bg-black flex justify-center items-center">
                <img
                  src={post.image}
                  alt="post"
                  className="max-h-[75vh] w-auto object-contain"
                />
              </div>
            )}

            {/* POST INFO */}
            <div className="p-5 text-white border-t border-zinc-800">
              <p className="font-semibold text-lg">
                {post.user?.username}
              </p>

              {post.caption && (
                <p className="text-zinc-300 mt-2 leading-relaxed">
                  {post.caption}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PostModal;
