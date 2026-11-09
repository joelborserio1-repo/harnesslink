import Link from "next/link";
import type { InsiderEditionSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";

// Past editions of The Insider, newest first, grouped by month: a date, the
// email's preview line, and a link to the edition as it was sent.
export default function InsiderEditions({ editions, limit }: { editions: InsiderEditionSummary[]; limit?: number }) {
  const list = limit ? editions.slice(0, limit) : editions;
  if (!list.length) {
    return <p className="mt-3 max-w-[60ch] text-[15px] text-[#474b54]">No past editions yet — subscribe and the next one lands in your inbox on Thursday.</p>;
  }
  const months = new Map<string, InsiderEditionSummary[]>();
  for (const e of list) {
    const key = e.date.slice(0, 7);
    months.set(key, [...(months.get(key) || []), e]);
  }
  const monthName = (ym: string) =>
    new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mt-2">
      {[...months.entries()].map(([ym, items]) => (
        <section key={ym} className="mt-6">
          <h3 className="kicker !text-muted">{monthName(ym)}</h3>
          <ol className="mt-2 border-t border-line">
            {items.map((e) => (
              <li key={e.slug} className="group border-b border-line">
                <Link href={e.url} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-baseline">
                  <span className="font-headline text-[18px] font-bold text-navy">
                    <span className="hl-link">{formatDate(e.date)}</span>
                  </span>
                  <span className="text-[14px] leading-snug text-[#474b54]">{e.summary || "The Insider — Harnesslink's weekly briefing"}</span>
                  <span className="font-ui hidden text-[12px] font-bold uppercase tracking-[0.1em] text-navy group-hover:text-blue sm:block">Read →</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
