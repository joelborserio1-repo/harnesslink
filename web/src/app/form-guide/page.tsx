import type { Metadata } from "next";
import Link from "next/link";
import { listFormGuide, type FormGuideCard } from "@/lib/api";
import AdSlot from "@/components/AdSlot";

// The daily form guide: every AU and NZ harness meeting on the TAB, one card
// per track (CMS src/form-guide.ts creates them each morning).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Harness racing form guide and tips: Australia and New Zealand",
  description:
    "Today's harness racing form guide for every Australian and New Zealand meeting: fields, form, silks, TAB prices, our Harness Analyst's tips and results.",
  alternates: { canonical: "https://harnesslink.com/form-guide/" },
};

const COUNTRY: Record<string, string> = { NZ: "New Zealand", AU: "Australia" };
const nzToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const timeAt = (iso: string | null, tz: string) =>
  iso ? new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso)).replace(" ", "") : null;

function Day({ date, cards, today }: { date: string; cards: FormGuideCard[]; today: string }) {
  const countries = ["NZ", "AU"].filter((c) => cards.some((x) => x.country === c));
  const heading = date === today ? `Today, ${dayLabel(date)}` : date > today ? dayLabel(date) : `${dayLabel(date)} (results)`;
  return (
    <section className="fg-day">
      <h2 className="fg-day-h">{heading}</h2>
      {countries.map((c) => (
        <div key={c} className="fg-country">
          <h3 className="fg-country-h">{COUNTRY[c] || c}</h3>
          <ul className="fg-list">
            {cards
              .filter((x) => x.country === c)
              .map((x) => (
                <li key={x.slug}>
                  <Link href={x.path} className="fg-row">
                    <span className="fg-venue">
                      <strong>{x.venue}</strong>
                      <span>
                        {x.races} races{x.firstRace ? ` · first race ${timeAt(x.firstRace, x.timezone)} local` : ""}
                        {x.trackCondition ? ` · track ${x.trackCondition.toLowerCase()}` : ""}
                      </span>
                    </span>
                    <span className="fg-tip">
                      {x.bestBet ? (
                        <>
                          <span className="fg-tip-label">Best bet</span> R{x.bestBet.race} {x.bestBet.horse}
                        </>
                      ) : x.hasTips ? (
                        "Tips in"
                      ) : (
                        <span className="fg-muted">Fields &amp; form · tips to come</span>
                      )}
                    </span>
                    <span className="fg-go" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default async function FormGuidePage() {
  const cards = await listFormGuide();
  const today = nzToday();
  const days = [...new Set(cards.map((c) => c.date))].sort((a, b) => {
    // Today first, then days ahead, then the days just gone.
    const rank = (d: string) => (d === today ? 0 : d > today ? 1 : 2);
    return rank(a) - rank(b) || (rank(a) === 2 ? b.localeCompare(a) : a.localeCompare(b));
  });

  return (
    <div className="wrap py-7">
      <header className="mb-6 border-b border-line pb-5">
        <p className="kicker kicker-gold">Form guide</p>
        <h1 className="font-headline mt-1 text-[36px] font-bold leading-[1.05] text-navy [text-wrap:balance] sm:text-[46px]">
          Harness racing form guide &amp; tips
        </h1>
        <p className="mt-3 max-w-[64ch] text-[15px] text-[#474b54]">
          Every Australian and New Zealand meeting, one card per track: fields, form, silks and TAB prices, with our Harness
          Analyst&rsquo;s tips. Prices, scratchings and results update on each card through the day.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="sheet min-w-0 px-5 py-6 sm:px-8">
          {days.length === 0 ? (
            <p className="py-10 text-neutral-500">Today&rsquo;s cards are published from 7am NZ time on race days.</p>
          ) : (
            days.map((d) => <Day key={d} date={d} today={today} cards={cards.filter((c) => c.date === d)} />)
          )}
          <p className="fg-small">
            Fields, form, silks, prices and results from TAB via the HarnessLink racing service. Fixed odds change until the race
            starts. Gamble responsibly.
          </p>
        </div>
        <aside className="flex flex-col gap-7">
          <AdSlot format="mpu" zone="archive-rail" />
        </aside>
      </div>
    </div>
  );
}
