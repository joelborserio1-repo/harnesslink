import type { Metadata } from "next";
import InsiderSignup from "@/components/InsiderSignup";

export const metadata: Metadata = {
  title: "Explore Editions — The Insider",
  description: "Past editions of The Insider, Harnesslink's weekly harness racing briefing.",
  alternates: { canonical: "https://harnesslink.com/the-insider/editions/" },
};

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <InsiderSignup heading="The Insider" kicker="Explore editions" />
      <section className="mt-10">
        <h2 className="rule-head font-headline text-2xl font-bold text-navy">Past editions</h2>
        <p className="mt-3 max-w-[60ch] text-[15px] text-[#474b54]">
          Past editions will be listed here once the archive is migrated. Subscribe above and the
          next one lands in your inbox on Thursday.
        </p>
      </section>
    </div>
  );
}
