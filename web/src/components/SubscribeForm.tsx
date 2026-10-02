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
        You&apos;re in — look out for The Insider on Thursday.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className={`flex border ${dark ? "border-white/40" : "border-navy"}`}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          aria-label="Email address"
          className="w-full min-w-0 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-500 focus:bg-mist"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`btn shrink-0 disabled:opacity-60 ${dark ? "btn-gold" : ""}`}
        >
          {state === "loading" ? "…" : cta}
        </button>
      </div>
      {state === "error" && (
        <p className={`mt-1.5 text-xs ${dark ? "text-amber" : "text-red"}`}>
          That didn&apos;t go through — check the address and try again.
        </p>
      )}
    </form>
  );
}
