"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RegisterForm, SignInForm } from "@/components/account/forms";

const FREE_LIMIT = 3; // free stories per 30 days for readers who aren't signed in
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

// The metered registration wall (replaces Leaky Paywall: 3 stories per 30
// days, then sign in or create a free account). Client-side only, so the
// full story is still in the page for search engines. Signed-in readers have
// the hl_reader cookie and never see it.
function signedIn() {
  return document.cookie.split("; ").some((c) => c.startsWith("hl_reader="));
}

// Stories read in the last 30 days: [[slug, time], …]. Older browsers stored
// plain slugs; those count as read now.
function readRecently(slug: string): number {
  const now = Date.now();
  const stored: Array<string | [string, number]> = JSON.parse(localStorage.getItem("hl_viewed") || "[]");
  const seen = new Map<string, number>();
  for (const entry of stored) {
    const [s, t] = typeof entry === "string" ? [entry, now] : entry;
    if (now - t < PERIOD_MS) seen.set(s, t);
  }
  if (!seen.has(slug)) seen.set(slug, now);
  localStorage.setItem("hl_viewed", JSON.stringify([...seen]));
  return seen.size;
}

export default function RegistrationWall({ slug }: { slug: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">("signin");

  useEffect(() => {
    try {
      if (signedIn()) return;
      if (readRecently(slug) > FREE_LIMIT) {
        // Browser storage only exists after load, so this can't be computed during render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShow(true);
        window.dataLayer?.push({ event: "paywall_view" });
      }
    } catch {
      /* storage blocked — never wall */
    }
  }, [slug]);

  if (!show) return null;

  const done = () => {
    window.dataLayer?.push({ event: mode === "signin" ? "login" : "sign_up" });
    setShow(false);
    router.refresh(); // header shows their name
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[25%] z-50 flex items-end justify-center overflow-y-auto bg-gradient-to-b from-transparent via-white/85 to-white">
      <div className="sheet mb-6 w-[min(520px,94vw)] border-t-[3px] border-t-navy p-6 text-center sm:mb-10 sm:p-8">
        <p className="kicker kicker-gold">Keep reading — free</p>
        <h2 className="font-headline mt-2 text-2xl font-bold text-navy sm:text-3xl">
          {mode === "signin" ? "Sign in to keep reading" : "Create your free account"}
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[15px] text-[#41454e]">
          You&apos;ve read your {FREE_LIMIT} free stories this month. Harnesslink is free with an account — unlimited
          harness racing news, plus The Insider every Thursday. No payment, ever.
        </p>
        <div className="mx-auto mt-5 max-w-md">
          {mode === "signin" ? (
            <SignInForm onDone={done} cta="Sign in & keep reading" />
          ) : (
            <RegisterForm onDone={done} source="wall" cta="Create account & keep reading" />
          )}
        </div>
        <p className="mt-5 border-t border-line pt-4 text-[14px] text-ink">
          {mode === "signin" ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "register" : "signin")}
            className="font-semibold text-navy underline underline-offset-2"
          >
            {mode === "signin" ? "Create one free" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
