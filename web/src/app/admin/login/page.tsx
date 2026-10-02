import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/admin";
import { signInAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign-in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getMe()) redirect("/admin/");
  const { error } = await searchParams;

  const input = "mt-1 block w-full border border-neutral-300 bg-white px-3 py-2.5 text-[15px] font-normal text-neutral-900";

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <p className="kicker kicker-gold">Editorial portal</p>
      <h1 className="font-headline mt-1 text-3xl font-bold text-navy">Staff sign-in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Use your own Harnesslink staff account. If you don&apos;t have one yet, ask an admin to set
        it up.
      </p>

      {error && (
        <p role="alert" className="mt-5 border-l-[3px] border-red bg-white px-3 py-2.5 text-sm text-neutral-800">
          {error}
        </p>
      )}

      <form action={signInAction} className="mt-6 space-y-4 border border-neutral-200 bg-white p-5">
        <label className="block text-sm font-semibold text-neutral-700">
          Email
          <input type="email" name="email" required autoComplete="username" autoFocus className={input} />
        </label>
        <label className="block text-sm font-semibold text-neutral-700">
          Password
          <input type="password" name="password" required autoComplete="current-password" className={input} />
        </label>
        <button className="btn w-full">Sign in</button>
      </form>
    </div>
  );
}
