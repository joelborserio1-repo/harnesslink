import type { Metadata } from "next";
import Link from "next/link";
import InsiderSignup from "@/components/InsiderSignup";

export const metadata: Metadata = {
  title: "Sign Up — The Insider",
  description: "Sign up free for The Insider, Harnesslink's weekly harness racing briefing, every Thursday.",
  alternates: { canonical: "https://harnesslink.com/the-insider/sign-up/" },
};

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <InsiderSignup heading="Sign up for The Insider" kicker="Free weekly briefing" />
      <p className="mt-6 text-sm text-muted">
        Already subscribed?{" "}
        <Link href="/the-insider/editions/" className="font-semibold text-navy underline underline-offset-2">
          Browse past editions
        </Link>
        .
      </p>
    </div>
  );
}
