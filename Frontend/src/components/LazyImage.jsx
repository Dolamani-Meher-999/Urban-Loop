import { useState } from "react";

function LazyImage({ src, alt, onClick }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative">
      {!loaded && (
        <div className="w-full h-60 bg-zinc-800 animate-pulse rounded-xl" />
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onClick={onClick}
        className={`w-full h-auto object-cover cursor-pointer transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0 absolute inset-0"
        }`}
      />
    </div>
  );
}

export default LazyImage;