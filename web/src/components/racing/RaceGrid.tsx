import Link from "next/link";
import type { Meeting, RaceDetail } from "@/lib/harnesslink";
import { raceHref, raceTime } from "@/lib/racingLinks";

// Meetings down the side, races across: the race-day overview betting sites use.
// Each cell opens the race. Results show the winner's number; the next race to run is gold.
export default function RaceGrid({ meetings, details, nextId }: { meetings: Meeting[]; details?: Map<number, RaceDetail>; nextId: number | null }) {
  const cols = Math.max(...meetings.map((m) => m.races.at(-1)?.race_number ?? 0), 1);
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Meeting</th>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className="px-1 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted">R{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => {
            const byNo = new Map(m.races.map((r) => [r.race_number, r]));
            return (
              <tr key={m.id} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left">
                  <span className="block whitespace-nowrap font-bold text-ink">{m.venue}</span>
                </th>
                {Array.from({ length: cols }, (_, i) => {
                  const r = byNo.get(i + 1);
                  if (!r) return <td key={i} />;
                  const done = r.status.startsWith("result");
                  const winner = details?.get(r.id)?.entries.find((e) => e.position === 1);
                  const isNext = r.id === nextId;
                  return (
                    <td key={i} className="p-0.5">
                      <Link
                        href={raceHref(r.id)}
                        title={r.name ?? `Race ${r.race_number}`}
                        className={`flex h-10 min-w-[58px] rounded-[4px] items-center justify-center px-1.5 text-[12.5px] font-bold tabular-nums transition ${
                          isNext
                            ? "bg-amber text-[#1d1500]"
                            : done
                              ? "bg-mist text-navy hover:bg-navy hover:text-white"
                              : "border border-line text-ink hover:border-navy hover:bg-navy hover:text-white"
                        }`}
                      >
                        {done ? (winner?.saddlecloth != null ? `#${winner.saddlecloth}` : "Result") : raceTime(r.start_time, m.timezone)}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
