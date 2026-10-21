import Link from "next/link";
import Silk from "@/components/racing/Silk";
import type { RunLine } from "@/lib/harnesslink";
import { dayLabel, horseHref, money, ordinal, personHref, raceClock, raceHref } from "@/lib/racingLinks";

// Runs for a horse or person, newest first. `focus` decides what the second line shows:
// for a horse, who drove; for a person, which horse.
export default function RunList({ runs, focus, personId }: { runs: RunLine[]; focus: "horse" | "person"; personId?: number }) {
  if (!runs.length) return <p className="sheet px-4 py-6 text-sm text-muted">No runs in our data yet.</p>;
  return (
    <ol className="sheet divide-y divide-line">
      {runs.map((r) => {
        const pos = r.position;
        const role = personId != null ? (r.driver_id === personId ? "Drove" : r.trainer_id === personId ? "Trained" : null) : null;
        return (
          <li key={`${r.race_id}-${r.horse_id}`} className="grid grid-cols-[52px_1fr_auto] items-start gap-3 px-4 py-3">
            <span className={`grid h-11 w-11 place-items-center text-[14px] font-extrabold ${r.scratched ? "bg-mist text-muted" : pos === 1 ? "bg-amber text-[#1d1500]" : pos && pos <= 3 ? "bg-navy text-white" : "border border-line text-navy"}`}>
              {r.scratched ? "SCR" : pos ? ordinal(pos) : r.placing ?? "–"}
            </span>
            <div className="min-w-0">
              <Link href={raceHref(r.race_id)} className="block truncate text-[14.5px] font-bold text-ink hover:text-blue">
                {r.venue} R{r.race_number}
                <span className="font-normal text-muted"> · {r.major_race_name ?? r.race_name ?? r.class_short ?? ""}</span>
              </Link>
              <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
                {focus === "person" && <Silk path={r.colours_image} size={16} />}
                <span className="truncate">
                  {focus === "person" ? (
                    <>
                      {role && <span>{role} </span>}
                      <Link href={horseHref(r.horse_id)} className="font-semibold text-navy hover:underline">{r.horse_name}</Link>
                    </>
                  ) : (
                    r.driver_id ? <>Driven by <Link href={personHref(r.driver_id)} className="font-semibold text-navy hover:underline">{r.driver_name}</Link></> : r.driver_name
                  )}
                  {[r.distance_m && ` · ${r.distance_m}m`, r.margin_lengths != null && Number(r.margin_lengths) > 0 && ` · ${Number(r.margin_lengths)}L`, r.mile_rate != null && ` · MR ${raceClock(r.mile_rate)}`].filter(Boolean).join("")}
                </span>
              </p>
              {r.review_comment && <p className="mt-0.5 truncate text-[12px] italic text-muted">{r.review_comment}</p>}
            </div>
            <div className="text-right">
              <span className="block text-[12.5px] font-semibold tabular-nums text-ink">{dayLabel(r.meeting_date, { day: "numeric", month: "short", year: "2-digit" })}</span>
              {money(r.stakes_won) && Number(r.stakes_won) > 0 && <span className="block text-[12px] font-bold tabular-nums text-accent">{money(r.stakes_won)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatStrip({ items }: { items: [string, string | number | null | undefined][] }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <dl className="grid grid-cols-2 border-l border-t border-line bg-white sm:grid-cols-3 lg:grid-cols-6">
      {shown.map(([k, v]) => (
        <div key={k} className="border-b border-r border-line px-4 py-3.5">
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{k}</dt>
          <dd className="mt-1 font-headline text-[22px] font-bold tabular-nums text-navy">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
