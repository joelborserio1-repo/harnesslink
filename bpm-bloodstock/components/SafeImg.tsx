"use client";

import { useState } from "react";

/**
 * An <img> that hides itself (and shows an optional fallback) if the source is
 * missing or 404s. Keeps the UI clean when a photo hasn't been uploaded yet,
 * instead of showing a broken-image icon.
 */
export function SafeImg({
  src,
  alt = "",
  className = "",
  fallback = null,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
