"use client";

import { useEffect, useState } from "react";
import SubscribeForm from "@/components/SubscribeForm";

const FREE_LIMIT = 3; // free articles before the wall (site-wide, per browser)

// The metered free registration wall — the Leaky Paywall replacement. Counts
// distinct articles read in localStorage; past the limit (and not registered)
// it fades the article into a signup card. Entirely client-side, so the full
// article is still server-rendered and fully indexable (Googlebot never trips
// the wall). No payment — just a free email signup.
export default function RegistrationWall({ slug }: { slug: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("hl_registered") === "1") return;
      const viewed = new Set<string>(JSON.parse(localStorage.getItem("hl_viewed") || "[]"));
      viewed.add(slug);
      localStorage.setItem("hl_viewed", JSON.stringify([...viewed]));
      if (viewed.size > FREE_LIMIT) {
        setShow(true);
        window.dataLayer?.push({ event: "paywall_view" });
      }
    } catch {
      /* storage blocked — never wall */
    }
  }, [slug]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("hl_registered", "1");
    } catch {
      /* ignore */
    }
    setTimeout(() => setShow(false), 1400);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[42%] z-50 flex items-end justify-center bg-gradient-to-b from-transparent via-white/85 to-white">
      <div className="card mb-10 w-[min(560px,92vw)] p-6 text-center shadow-[0_10px_40px_rgba(8,31,91,0.22)] sm:p-8">
        <p className="eyebrow text-[15px]">Keep reading — free</p>
        <h2 className="font-headline text-2xl font-extrabold text-navy sm:text-3xl">
          You&apos;ve read your {FREE_LIMIT} free stories
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[15px] text-[#41454e]">
          Sign up free to keep reading Harnesslink — unlimited harness racing news, plus The Insider
          in your inbox every Thursday. No payment, ever.
        </p>
        <div className="mx-auto mt-5 max-w-md">
          <SubscribeForm cta="Sign up & keep reading" onDone={dismiss} />
        </div>
        <p className="mt-2 text-xs text-muted">Free forever · Unsubscribe any time</p>
      </div>
    </div>
  );
}
