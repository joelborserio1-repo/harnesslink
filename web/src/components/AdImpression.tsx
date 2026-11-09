"use client";

import { useEffect, useRef } from "react";

// Fires one viewable-impression beacon when the ad scrolls at least halfway
// into view (IntersectionObserver), so off-screen/prefetched ads aren't
// counted. Renders a tiny anchor element only.
// `query` carries the placement and country for the advertiser report.
export default function AdImpression({ id, query = "" }: { id: string; query?: string }) {
  const fired = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fired.current) {
          fired.current = true;
          fetch(`/ad/${id}/impression/${query}`, { method: "POST", keepalive: true }).catch(() => {});
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, query]);

  return <span ref={ref} aria-hidden style={{ position: "absolute", width: 1, height: 1 }} />;
}
