"use client";

import { useState } from "react";

// Reusable free-signup form (The Insider panel/page + the registration wall).
// POSTs the email to /api/subscribe and shows a success state. `onDone` lets
// the wall dismiss itself after a successful signup.
export default function SubscribeForm({
  dark = false,
  cta = "Subscribe free",
  onDone,
}: {
  dark?: boolean;
  cta?: string;
  onDone?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setState("done");
      window.dataLayer?.push({ event: "sign_up" });
      onDone?.();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className={`text-sm font-semibold ${dark ? "text-white" : "text-navy"}`}>
        ✓ You&apos;re in — look out for The Insider on Thursday.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        className="w-full rounded-lg px-3 py-2.5 text-sm text-neutral-900"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="shrink-0 rounded-lg bg-amber px-4 py-2.5 text-sm font-bold text-[#241a00] hover:brightness-105 disabled:opacity-60"
      >
        {state === "loading" ? "…" : cta}
      </button>
      {state === "error" && (
        <span className={`text-xs ${dark ? "text-amber" : "text-red-600"}`}>Enter a valid email.</span>
      )}
    </form>
  );
}
