import type { Metadata } from "next";
import InsiderSignup from "@/components/InsiderSignup";
import InsiderEditions from "@/components/InsiderEditions";
import { listInsiderEditions } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore Editions — The Insider",
  description: "Past editions of The Insider, Harnesslink's weekly harness racing briefing.",
  alternates: { canonical: "https://harnesslink.com/the-insider/editions/" },
};

export default async function Page() {
  const editions = await listInsiderEditions();
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <InsiderSignup heading="The Insider" kicker="Explore editions" />
      <section className="mt-10">
        <h2 className="rule-head font-headline text-2xl font-bold text-navy">Past editions</h2>
        <InsiderEditions editions={editions} />
      </section>
    </div>
  );
}
