"use client";

import { useState } from "react";
import Link from "next/link";

// Reader sign-in, create-account, forgot- and reset-password forms. Used on
// the registration wall and on /login/, /register/ and /password-reset/.
export const FIELD =
  "mt-1 w-full border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-navy";
const LABEL = "block text-left text-[13px] font-semibold text-ink";

type Result = { ok: boolean; message?: string; code?: string };

async function post(url: string, body: unknown): Promise<Result> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data?.error?.message, code: data?.error?.code };
  } catch {
    return { ok: false, message: "Couldn’t reach Harnesslink — check your connection and try again." };
  }
}

function Message({ result }: { result: Result | null }) {
  if (!result || result.ok || !result.message) return null;
  const info = result.code === "set-password";
  return (
    <p role={info ? "status" : "alert"} className={`text-left text-[14px] ${info ? "text-navy" : "text-red"}`}>
      {result.message}
    </p>
  );
}

export function SignInForm({ onDone, cta = "Sign in" }: { onDone: () => void; cta?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const r = await post("/api/account/login/", { email: f.get("email"), password: f.get("password") });
        setBusy(false);
        setResult(r);
        if (r.ok) onDone();
      }}
    >
      <label className={LABEL}>
        Email
        <input name="email" type="email" required autoComplete="email" className={FIELD} />
      </label>
      <label className={LABEL}>
        Password
        <input name="password" type="password" required autoComplete="current-password" className={FIELD} />
      </label>
      <Message result={result} />
      <button type="submit" disabled={busy} className="btn w-full disabled:opacity-60">
        {busy ? "Signing in…" : cta}
      </button>
      <Link href="/password-reset/" className="text-left text-[13px] text-navy underline underline-offset-2">
        Forgot password? / First time here since the new site?
      </Link>
    </form>
  );
}

export function RegisterForm({ onDone, source, cta = "Create free account" }: { onDone: () => void; source: string; cta?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const r = await post("/api/account/register/", {
          firstName: f.get("firstName"),
          lastName: f.get("lastName"),
          email: f.get("email"),
          password: f.get("password"),
          insider: f.get("insider") === "on",
          website: f.get("website"),
          source,
        });
        setBusy(false);
        setResult(r);
        if (r.ok) onDone();
      }}
    >
      <div className="hidden" aria-hidden>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          First name
          <input name="firstName" required maxLength={80} autoComplete="given-name" className={FIELD} />
        </label>
        <label className={LABEL}>
          Last name <span className="font-normal text-muted">(optional)</span>
          <input name="lastName" maxLength={80} autoComplete="family-name" className={FIELD} />
        </label>
      </div>
      <label className={LABEL}>
        Email
        <input name="email" type="email" required autoComplete="email" className={FIELD} />
      </label>
      <label className={LABEL}>
        Password <span className="font-normal text-muted">(at least 8 characters)</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={FIELD} />
      </label>
      <label className="flex items-start gap-2 text-left text-[14px] text-ink">
        <input name="insider" type="checkbox" defaultChecked className="mt-1" />
        <span>Send me The Insider every Thursday (free — unsubscribe any time)</span>
      </label>
      <Message result={result} />
      <button type="submit" disabled={busy} className="btn w-full disabled:opacity-60">
        {busy ? "Creating your account…" : cta}
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) {
    return (
      <p className="border-l-2 border-navy pl-3 text-[15px] text-ink">
        If there’s a Harnesslink account for that email, we’ve sent a link to set your password. It expires in 2 hours —
        check your junk folder if it hasn’t arrived in a few minutes.
      </p>
    );
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await post("/api/account/forgot/", { email: new FormData(e.currentTarget).get("email") });
        setBusy(false);
        setSent(true);
      }}
    >
      <label className={LABEL}>
        Email
        <input name="email" type="email" required autoComplete="email" className={FIELD} />
      </label>
      <button type="submit" disabled={busy} className="btn w-full disabled:opacity-60">
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}

export function ResetForm({ code, onDone }: { code: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await post("/api/account/reset/", { code, password: new FormData(e.currentTarget).get("password") });
        setBusy(false);
        setResult(r);
        if (r.ok) onDone();
      }}
    >
      <label className={LABEL}>
        New password <span className="font-normal text-muted">(at least 8 characters)</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={FIELD} />
      </label>
      <Message result={result} />
      {result?.code === "expired" && (
        <Link href="/password-reset/" className="text-[13px] text-navy underline underline-offset-2">
          Send me a new link
        </Link>
      )}
      <button type="submit" disabled={busy} className="btn w-full disabled:opacity-60">
        {busy ? "Saving…" : "Save password & sign in"}
      </button>
    </form>
  );
}
