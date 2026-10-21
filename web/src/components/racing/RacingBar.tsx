import Link from "next/link";
import { COUNTRY, dayHref, dayLabel, type RacingCountry, type RacingView } from "@/lib/racingLinks";

// Country + Fields/Results switch and the date strip. Only days we hold racing for are offered,
// so a reader can't land on an empty day; arrows step to the previous/next racing day.
export default function RacingBar({
  country,
  view,
  date,
  days,
  today,
}: {
  country: RacingCountry;
  view: RacingView;
  date: string;
  days: string[]; // ascending
  today: string;
}) {
  const i = days.indexOf(date);
  const prev = i > 0 ? days[i - 1] : null;
  const next = i >= 0 && i < days.length - 1 ? days[i + 1] : null;
  const start = Math.max(0, Math.min(i - 3, days.length - 7));
  const strip = days.slice(start, start + 7);

  const tab = (active: boolean) =>
    `px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] transition ${active ? "bg-white text-navy" : "text-white/75 hover:text-white"}`;

  return (
    <div className="bg-navy text-white">
      <div className="wrap flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="kicker text-amber!">Racing</p>
          <h1 className="mt-1 font-headline text-3xl font-bold leading-none sm:text-4xl">
            {view === "fields" ? "Fields" : "Results & Replays"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <nav className="flex border border-white/25" aria-label="Country">
            {(Object.keys(COUNTRY) as RacingCountry[]).map((c) => (
              <Link key={c} href={dayHref(c, view)} className={tab(c === country)} aria-current={c === country ? "page" : undefined}>
                {COUNTRY[c].label}
              </Link>
            ))}
          </nav>
          <nav className="flex border border-white/25" aria-label="View">
            <Link href={dayHref(country, "fields", date)} className={tab(view === "fields")} aria-current={view === "fields" ? "page" : undefined}>Fields</Link>
            <Link href={dayHref(country, "results", date)} className={tab(view === "results")} aria-current={view === "results" ? "page" : undefined}>Results</Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="wrap flex items-stretch">
          <DayArrow href={prev && dayHref(country, view, prev)} label="Previous racing day" dir="prev" />
          <ol className="flex flex-1 snap-x overflow-x-auto [scrollbar-width:none]">
            {strip.map((d, k) => {
              const active = d === date;
              // Phones show the chosen day with one either side; wider screens show the full week.
              const near = Math.abs(k - strip.indexOf(date)) <= 1 || strip.indexOf(date) === -1;
              return (
                <li key={d} className={`min-w-[88px] flex-1 snap-start ${near ? "" : "hidden sm:block"}`}>
                  <Link
                    href={dayHref(country, view, d)}
                    aria-current={active ? "date" : undefined}
                    className={`flex h-full flex-col items-center justify-center border-b-[3px] px-2 py-2.5 transition ${active ? "border-amber bg-white/10" : "border-transparent hover:bg-white/5"}`}
                  >
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                      {d === today ? "Today" : dayLabel(d, { weekday: "short" })}
                    </span>
                    <span className="mt-0.5 text-[15px] font-bold tabular-nums">{dayLabel(d, { day: "numeric", month: "short" })}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <DayArrow href={next && dayHref(country, view, next)} label="Next racing day" dir="next" />
        </div>
      </div>
    </div>
  );
}

function DayArrow({ href, label, dir }: { href: string | null; label: string; dir: "prev" | "next" }) {
  const icon = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label={label} className="grid w-11 shrink-0 place-items-center text-white/80 hover:bg-white/10 hover:text-white">{icon}</Link>
  ) : (
    <span aria-hidden="true" className="grid w-11 shrink-0 place-items-center text-white/20">{icon}</span>
  );
}
