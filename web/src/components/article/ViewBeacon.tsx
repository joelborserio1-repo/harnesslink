"use client";

import { useEffect, useRef } from "react";

// Fires a one-shot view ping when the article mounts in a real browser (so SSR,
// prefetch and most bots don't inflate the count). Renders nothing.
export default function ViewBeacon({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const url = `/track/view/${encodeURIComponent(slug)}`;
    // keepalive so it still sends if the user navigates away immediately.
    fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}
