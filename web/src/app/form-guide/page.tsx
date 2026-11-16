import type { Metadata } from "next";
import { listFormGuide } from "@/lib/api";
import AdSlot from "@/components/AdSlot";
import FormGuideHub from "@/components/analysis/FormGuideHub";

// The daily form guide: every AU and NZ harness meeting on the TAB, one card
// per track (CMS src/form-guide.ts creates them each morning).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Harness racing form guide and tips: Australia and New Zealand",
  description:
    "Today's harness racing form guide for every Australian and New Zealand meeting: fields, form, silks, TAB prices, our Harness Analyst's best bets and tips, and results.",
  alternates: { canonical: "https://harnesslink.com/form-guide/" },
};

const nzToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());

export default async function FormGuidePage() {
  const cards = await listFormGuide();
  const today = nzToday();
  const meetings = cards.filter((c) => c.date === today).length;
  const races = cards.filter((c) => c.date === today).reduce((n, c) => n + c.races.length, 0);

  return (
    <div className="wrap py-7">
      <header className="fg-head">
        <p className="kicker kicker-gold">Form guide</p>
        <h1 className="font-headline mt-1 text-[36px] font-bold leading-[1.05] text-navy [text-wrap:balance] sm:text-[46px]">
          Harness racing form guide &amp; tips
        </h1>
        <p className="fg-dek">
          {meetings
            ? `${meetings} meeting${meetings === 1 ? "" : "s"} and ${races} races across Australia and New Zealand today. `
            : ""}
          Our Harness Analyst&rsquo;s best bets and three picks in every race, with silks, TAB prices, track weather and
          results as they come in.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="sheet min-w-0 px-5 py-6 sm:px-8">
          <FormGuideHub cards={cards} today={today} />
          <p className="fg-small">
            Fields, form, silks, prices and results from TAB via the HarnessLink racing service. Fixed odds change until the race
            starts. Times are local to each track. Gamble responsibly.
          </p>
        </div>
        <aside className="flex flex-col gap-7 lg:sticky lg:top-20">
          <AdSlot format="mpu" zone="archive-rail" />
        </aside>
      </div>
    </div>
  );
}
