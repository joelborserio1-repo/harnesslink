"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FIELD, ForgotForm, RegisterForm, ResetForm, SignInForm } from "@/components/account/forms";
import type { Reader } from "@/lib/reader";

// Only ever send readers back to a page on this site.
const safeNext = (next?: string) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

function Sheet({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="wrap my-10">
      <div className="sheet mx-auto max-w-[480px] border-t-[3px] border-t-navy p-6 sm:p-8">
        <p className="kicker kicker-gold">{kicker}</p>
        <h1 className="font-headline mt-2 text-[28px] font-bold leading-tight text-navy">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function LoginPanel({ next }: { next?: string }) {
  const router = useRouter();
  const done = () => {
    router.push(safeNext(next));
    router.refresh();
  };
  return (
    <Sheet kicker="Your account" title="Sign in to Harnesslink">
      <SignInForm onDone={done} />
      <p className="mt-6 border-t border-line pt-4 text-[14px] text-ink">
        New here?{" "}
        <Link href={`/register/${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy underline underline-offset-2">
          Create a free account
        </Link>
      </p>
    </Sheet>
  );
}

export function RegisterPanel({ next }: { next?: string }) {
  const router = useRouter();
  const done = () => {
    router.push(safeNext(next));
    router.refresh();
  };
  return (
    <Sheet kicker="Free — no payment, ever" title="Create your free account">
      <RegisterForm onDone={done} source="register" />
      <p className="mt-6 border-t border-line pt-4 text-[14px] text-ink">
        Already have an account?{" "}
        <Link href="/login/" className="font-semibold text-navy underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </Sheet>
  );
}

export function PasswordResetPanel({ code }: { code?: string }) {
  const router = useRouter();
  if (code) {
    return (
      <Sheet kicker="Your account" title="Choose a new password">
        <ResetForm
          code={code}
          onDone={() => {
            router.push("/my-account/");
            router.refresh();
          }}
        />
      </Sheet>
    );
  }
  return (
    <Sheet kicker="Your account" title="Set or reset your password">
      <p className="mb-4 text-[15px] text-[#41454e]">
        Enter the email you signed up with and we’ll send you a link to choose a password. Had an account on the old site?
        Your password still works — but this is the way in if you’ve forgotten it.
      </p>
      <ForgotForm />
    </Sheet>
  );
}

export function AccountPanel({ reader }: { reader: Reader }) {
  const router = useRouter();
  const [insider, setInsider] = useState(reader.insider);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(changes: Partial<Reader>) {
    setBusy(true);
    const res = await fetch("/api/account/me/", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    setBusy(false);
    if (res.status === 401) return router.push("/login/?next=/my-account/");
    setSaved(res.ok ? "Saved." : "That didn’t save — try again.");
    router.refresh();
  }

  return (
    <Sheet kicker="Your account" title={`Hi ${reader.firstName || "there"}`}>
      <p className="text-[14px] text-muted">Signed in as {reader.email}</p>

      <form
        className="mt-6 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save({ firstName: String(f.get("firstName") || ""), lastName: String(f.get("lastName") || "") });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px] font-semibold text-ink">
            First name
            <input name="firstName" defaultValue={reader.firstName} maxLength={80} className={FIELD} />
          </label>
          <label className="block text-[13px] font-semibold text-ink">
            Last name
            <input name="lastName" defaultValue={reader.lastName} maxLength={80} className={FIELD} />
          </label>
        </div>
        <button type="submit" disabled={busy} className="btn justify-self-start disabled:opacity-60">
          Save name
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={insider}
            disabled={busy}
            onChange={(e) => {
              setInsider(e.target.checked);
              save({ insider: e.target.checked });
            }}
            className="mt-1"
          />
          <span>
            <b>The Insider</b> — our free newsletter every Thursday
          </span>
        </label>
      </div>
      {saved && <p className="mt-3 text-[14px] text-navy">{saved}</p>}

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-[14px]">
        <Link href="/password-reset/" className="text-navy underline underline-offset-2">
          Change password
        </Link>
        <button
          type="button"
          className="text-navy underline underline-offset-2"
          onClick={async () => {
            await fetch("/api/account/logout/", { method: "POST" });
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </Sheet>
  );
}
