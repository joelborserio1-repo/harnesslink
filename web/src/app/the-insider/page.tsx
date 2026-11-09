import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import InsiderEditions from "@/components/InsiderEditions";
import { listInsiderEditions } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Insider — Free Weekly Harness Racing Briefing",
  description:
    "Sign up free for The Insider, Harnesslink's weekly briefing — form, features and the tips that matter, every Thursday. Browse past editions.",
  alternates: { canonical: "https://harnesslink.com/the-insider/" },
};

export default async function InsiderPage() {
  const editions = await listInsiderEditions();
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* Sign-up hero */}
      <section
        className="overflow-hidden p-8 text-white sm:p-12"
        style={{ background: "linear-gradient(160deg, var(--color-navy), #0a2470)" }}
      >
        <div className="max-w-2xl">
          <p className="kicker kicker-gold text-[#9db4ec]">Subscriber Briefing</p>
          <h1 className="font-headline text-4xl font-extrabold sm:text-5xl">The Insider</h1>
          <p className="mt-3 text-lg text-[#cdd8f4]">
            Harnesslink&apos;s free weekly briefing — form, features and the tips that matter,
            landing in your inbox every Thursday.
          </p>

          <div className="mt-6 max-w-md">
            <SubscribeForm dark cta="Subscribe free" />
          </div>
          <p className="mt-2 text-xs text-[#9db4ec]">Free forever. Unsubscribe any time.</p>
        </div>
      </section>

      {/* Past editions */}
      <section className="mt-10">
        <h2 className="mb-4 border-b-2 border-navy pb-2 font-headline text-2xl font-extrabold text-navy">
          Past Editions
        </h2>
        <InsiderEditions editions={editions} limit={6} />
        {editions.length > 6 && (
          <p className="mt-5">
            <Link href="/the-insider/editions/" className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-navy hover:text-blue">
              All {editions.length} past editions →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
