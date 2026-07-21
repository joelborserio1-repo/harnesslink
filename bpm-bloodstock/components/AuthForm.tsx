"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <div className="card p-8">
        <p className="eyebrow">{isRegister ? "Join BPM" : "Welcome back"}</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-cream">
          {isRegister ? "Create your account" : "Sign in"}
        </h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isRegister && (
            <div>
              <label className="field-label">Full name</label>
              <input name="name" required className="field" placeholder="Jane Owner" />
            </div>
          )}
          <div>
            <label className="field-label">Email</label>
            <input
              name="email"
              type="email"
              required
              className="field"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={isRegister ? 8 : 1}
              className="field"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button disabled={busy} className="btn-gold w-full">
            {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cream/55">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-gold hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to BPM?{" "}
              <Link href="/register" className="text-gold hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>

        {!isRegister && (
          <div className="mt-6 rounded-lg border border-gold/20 bg-gold/5 p-3 text-center text-xs text-cream/60">
            Demo login — <span className="text-gold-200">alex@example.com</span> /
            password123 · admin@bpmbloodstock.com / password123
          </div>
        )}
      </div>
    </div>
  );
}
