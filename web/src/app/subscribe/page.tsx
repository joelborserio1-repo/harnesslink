import type { Metadata } from "next";
import Link from "next/link";
import InsiderSignup from "@/components/InsiderSignup";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Subscribe free to Harnesslink and The Insider — harness racing news from Australia, New Zealand, North America and Europe.",
  alternates: { canonical: "https://harnesslink.com/subscribe/" },
};

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <InsiderSignup heading="Subscribe to Harnesslink" kicker="Free" />
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
