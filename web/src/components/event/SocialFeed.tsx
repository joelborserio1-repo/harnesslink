"use client";

import { useEffect, useRef } from "react";

// Curator.io feed (the event's X account and hashtags, curated in Curator).
// X's own embeds show nothing to signed-out readers, so Curator it is. The
// script is added after the page loads and only once.
export default function SocialFeed({ feedId }: { feedId: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!/^[a-f0-9-]{36}$/.test(feedId) || document.querySelector(`script[data-curator="${feedId}"]`)) return;
    const s = document.createElement("script");
    s.async = true;
    s.charset = "UTF-8";
    s.src = `https://cdn.curator.io/published/${feedId}.js`;
    s.dataset.curator = feedId;
    document.body.appendChild(s);
  }, [feedId]);

  return (
    <div ref={box} className="event-social h-full max-h-[620px] overflow-y-auto lg:max-h-none">
      <div id="curator-feed-default-feed-layout">
        <a href="https://curator.io" target="_blank" rel="noopener noreferrer" className="crt-logo crt-tag text-[11px] text-muted">
          Powered by Curator.io
        </a>
      </div>
    </div>
  );
}
