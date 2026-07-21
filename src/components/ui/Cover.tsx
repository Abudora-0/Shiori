"use client";

import { useState } from "react";

/**
 * Cover image with two fixes over a bare <img>:
 * - referrerPolicy="no-referrer": many manga CDNs (Mihon source thumbnails
 *   especially) block hotlinking based on the Referer header.
 * - graceful fallback to a 栞 placeholder when the image is missing or 404s.
 */
export function Cover({
  src,
  alt = "",
  className = "",
}: {
  src?: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-800 font-display text-faint ${className}`}
        role="img"
        aria-label={alt || "No cover"}
      >
        栞
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
