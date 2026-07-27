"use client";

import { useEffect, useState } from "react";

/**
 * Slim, dismissible rebrand notice. Sits above the sticky nav so it scrolls
 * away and never nags. Dismissal is remembered per browser; bump STORAGE_KEY
 * if the message changes so returning owners see the new one.
 */
const STORAGE_KEY = "ss_announce_v1";

export function AnnouncementBanner() {
  // Start hidden so a returning (dismissed) visitor never sees a flash of it;
  // reveal on mount only if they haven't dismissed it before.
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode / storage off - fine, it just won't persist */
    }
  }

  if (!show) return null;

  return (
    <div className="relative border-b border-gold/25 bg-green-800 text-cream">
      <div className="container-bpm flex items-center gap-4 py-2.5 pr-10 text-center sm:justify-center">
        <p className="mx-auto text-[13px] leading-snug text-cream/90">
          <span className="font-heading uppercase tracking-wide text-gold">
            New name, same heart.
          </span>{" "}
          BPM Bloodstock&apos;s micro-share ownership is now{" "}
          <span className="font-semibold text-cream">
            StrideShares by BPM Bloodstock
          </span>
          . Your shares, account and ownership are unchanged.
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-cream/60 transition hover:bg-white/10 hover:text-cream"
        >
          ×
        </button>
      </div>
    </div>
  );
}
