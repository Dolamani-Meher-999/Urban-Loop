import { AnimatePresence } from "framer-motion";

function PostModal({ post, onClose }) {
  return (
    <AnimatePresence>
      {post && (
        <motion.div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-zinc-900 rounded-2xl overflow-hidden max-w-3xl w-full"
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.85 }}
            onClick={(e) => e.stopPropagation()}
          >
            {post.image && (
              <img
                src={post.image}
                alt="post"
                className="w-full max-h-[70vh] object-cover"
              />
            )}

            <div className="p-4 text-white">
              <p className="font-semibold">{post.user?.username}</p>
              <p className="text-zinc-300 mt-2">{post.caption}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PostModal;