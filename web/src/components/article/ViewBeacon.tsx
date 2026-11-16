"use client";

import { useEffect, useRef } from "react";

// Fires a one-shot read ping when the story opens in a real browser (so SSR,
// prefetch and most bots don't count), including the Facebook, Instagram and
// X in-app browsers. Sends where the reader came from (referrer and
// utm_source) so the CMS can count reads by source (cms/src/story-stats.ts),
// and whether this browser has already counted this story today, so a reload
// is a view but not a new reader. No cookies. Renders nothing.
export default function ViewBeacon({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
    const key = `hl-read:${slug}`;
    let first = 1;
    try {
      if (localStorage.getItem(key) === today) first = 0;
      else localStorage.setItem(key, today);
    } catch {
      // storage blocked: the CMS dedupes on its own
    }
    let utm = "";
    try {
      utm = new URLSearchParams(window.location.search).get("utm_source") || "";
    } catch {}
    const url = `/track/view/${encodeURIComponent(slug)}/`; // trailing slash: the site adds one, so skip the redirect
    // keepalive so it still sends if the reader navigates away immediately.
    fetch(url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r: document.referrer.slice(0, 500), u: utm.slice(0, 60), f: first }),
    }).catch(() => {});
  }, [slug]);
  return null;
}
