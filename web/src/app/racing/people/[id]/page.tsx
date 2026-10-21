import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RunList, { StatStrip } from "@/components/racing/RunList";
import { getPerson, type Record } from "@/lib/harnesslink";
import { dayLabel, horseHref, money, raceHref, todayIn } from "@/lib/racingLinks";

type Props = { params: Promise<{ id: string }> };
const personId = async (p: Props["params"]) => { const n = Number((await p).id); return Number.isInteger(n) && n > 0 ? n : null; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await personId(params);
  const p = id ? await getPerson(id) : null;
  return p ? { title: `${p.name} – drives, trains and results` } : {};
}

const pct = (v: number | null) => (v == null ? null : `${Math.round(v)}%`);

export default async function PersonPage({ params }: Props) {
  const id = await personId(params);
  const p = id ? await getPerson(id) : null;
  if (!p) notFound();

  const today = todayIn("Pacific/Auckland");
  const upcoming = p.runs.filter((r) => !r.placing && !r.scratched && r.meeting_date >= today).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || a.race_number - b.race_number);
  const past = p.runs.filter((r) => !upcoming.includes(r)).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  const roles = [p.as_driver.starts > 0 && "Driver", p.as_trainer.starts > 0 && "Trainer"].filter(Boolean).join(" and ") || "Driver / trainer";

  return (
    <>
      <div className="bg-navy text-white">
        <div className="wrap py-8">
          <p className="kicker text-amber!">{roles}</p>
          <h1 className="mt-1 font-headline text-4xl font-bold leading-none sm:text-5xl">{p.name}</h1>
          {p.locality && <p className="mt-2 text-[15px] text-white/75">{p.locality}</p>}
        </div>
      </div>

      <div className="wrap py-7">
        <div className={`grid gap-6 ${p.as_driver.starts > 0 && p.as_trainer.starts > 0 ? "xl:grid-cols-2" : ""}`}>
          {p.as_driver.starts > 0 && <RoleRecord label="As driver" r={p.as_driver} />}
          {p.as_trainer.starts > 0 && <RoleRecord label="As trainer" r={p.as_trainer} />}
        </div>
        <p className="mt-2 text-[12px] text-muted">Counts cover the races in our data.</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <h2 className="panel-label mb-3">Results</h2>
            <RunList runs={past} focus="person" personId={p.id} />
          </div>
          <aside>
            <h2 className="panel-label mb-3">Coming up</h2>
            {upcoming.length ? (
              <ol className="sheet divide-y divide-line">
                {upcoming.map((r) => (
                  <li key={`${r.race_id}-${r.horse_id}`} className="px-4 py-3">
                    <Link href={raceHref(r.race_id)} className="block text-[14px] font-bold text-ink hover:text-blue">
                      {r.venue} R{r.race_number}
                    </Link>
                    <p className="text-[12.5px] text-muted">
                      {dayLabel(r.meeting_date)} · {r.driver_id === p.id ? "Drives" : "Trains"}{" "}
                      <Link href={horseHref(r.horse_id)} className="font-semibold text-navy hover:underline">{r.horse_name}</Link>
                      {r.barrier ? ` · Barrier ${r.barrier}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="sheet px-4 py-6 text-sm text-muted">No upcoming drives or runners in our data.</p>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function RoleRecord({ label, r }: { label: string; r: Record }) {
  return (
    <section>
      <h2 className="panel-label mb-3">{label}</h2>
      <StatStrip items={[["Starts", r.starts], ["Wins", r.wins], ["Places", r.seconds + r.thirds], ["Win %", pct(r.win_pct)], ["Place %", pct(r.place_pct)], ["Stakes", money(r.stakes)]]} />
    </section>
  );
}
