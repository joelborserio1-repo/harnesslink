"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SubscribeForm from "@/components/SubscribeForm";

// "The Insider" sign-up pop-up, site wide. Signs readers up through the same
// form as the Insider page (reader list + Mailchimp audience, tagged "popup").
//
// Polite by design:
// - not for signed-in readers, nor on the sign-up, sign-in and account pages
// - never on top of the registration wall
// - appears after 25 seconds on a page, or once a reader has scrolled half
//   way down a story, or (on a computer) when the mouse heads for the tabs
// - only from the second page a reader looks at
// - closing it keeps it away for 14 days; signing up keeps it away for good
// Remembered in this browser only (localStorage); nothing is sent until the
// reader signs up.

const KEY = "hl_insider_popup";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const DELAY_MS = 25_000;
const SKIP = /^\/(subscribe|the-insider|login|register|my-account|password-reset)(\/|$)/;

type Memory = { views?: number; closedAt?: number; joined?: boolean };
const read = (): Memory => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};
const write = (m: Memory) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
};
const signedIn = () => document.cookie.split("; ").some((c) => c.startsWith("hl_reader="));
const wallOpen = () => !!document.querySelector("[data-hl-wall]");

export default function InsiderPopup() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const shown = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Count page views; decide whether this page may show it.
  useEffect(() => {
    if (SKIP.test(pathname)) return;
    let m: Memory;
    try {
      if (signedIn()) return;
      m = read();
    } catch {
      return;
    }
    m.views = (m.views || 0) + 1;
    write(m);
    if (m.joined || (m.closedAt && Date.now() - m.closedAt < SNOOZE_MS) || m.views < 2 || shown.current) return;

    const show = () => {
      if (shown.current || wallOpen()) return;
      shown.current = true;
      setOpen(true);
      window.dataLayer?.push({ event: "newsletter_popup_view" });
      cleanup();
    };
    const timer = window.setTimeout(show, DELAY_MS);
    const onScroll = () => {
      const story = !!document.querySelector("article");
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (story && h > 0 && window.scrollY / h > 0.5) show();
    };
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    }
    return cleanup;
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    if (!joined) write({ ...read(), closedAt: Date.now() });
  }, [joined]);

  // Escape closes it; focus the first field when it opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, close]);

  if (!open) return null;

  const done = () => {
    setJoined(true);
    write({ ...read(), joined: true });
    window.dataLayer?.push({ event: "newsletter_popup_signup" });
    window.setTimeout(() => setOpen(false), 3500);
  };

  return (
    <div className="insider-pop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialogRef} className="insider-pop-box" role="dialog" aria-modal="true" aria-labelledby="insider-pop-title">
        <button type="button" className="insider-pop-close" onClick={close} aria-label="Close">
          ×
        </button>
        <div className="insider-pop-head">
          <p className="insider-pop-kicker">The Insider</p>
          <h2 id="insider-pop-title">Harness racing&rsquo;s best, in your inbox</h2>
        </div>
        <div className="insider-pop-body">
          <p className="insider-pop-lede">Our free weekly newsletter for people inside the sport, every Thursday.</p>
          <ul className="insider-pop-points">
            <li>Exclusive stories and interviews you won&rsquo;t find anywhere else</li>
            <li>The week&rsquo;s big races, results and talking points from around the harness racing world</li>
          </ul>
          <SubscribeForm cta="Sign me up" source="popup" onDone={done} />
          <p className="insider-pop-small">Free. Unsubscribe any time.</p>
          {!joined && (
            <button type="button" className="insider-pop-no" onClick={close}>
              No thanks
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
