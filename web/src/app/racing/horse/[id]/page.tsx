import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RunList, { StatStrip } from "@/components/racing/RunList";
import Silk from "@/components/racing/Silk";
import { getHorse } from "@/lib/harnesslink";
import { dayLabel, money, personHref, raceClock, raceHref, todayIn } from "@/lib/racingLinks";

type Props = { params: Promise<{ id: string }> };
const horseId = async (p: Props["params"]) => { const n = Number((await p).id); return Number.isInteger(n) && n > 0 ? n : null; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await horseId(params);
  const h = id ? await getHorse(id) : null;
  return h ? { title: `${h.name} – form and results` } : {};
}

export default async function HorsePage({ params }: Props) {
  const id = await horseId(params);
  const h = id ? await getHorse(id) : null;
  if (!h) notFound();

  const today = todayIn("Pacific/Auckland");
  const upcoming = h.runs.filter((r) => !r.placing && !r.scratched && r.meeting_date >= today).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const past = h.runs.filter((r) => !upcoming.includes(r)).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  const life = h.career.lifetime.find((l) => !l.description || /total|all/i.test(l.description)) ?? h.career.lifetime[0];
  const rec = life ? { starts: life.starts, wins: life.firsts, seconds: life.seconds, thirds: life.thirds, stakes: life.stakes } : h.record;
  const foaled = h.foal_date ? Number(h.foal_date.slice(0, 4)) : h.foal_season;
  const about = [foaled && `${new Date().getFullYear() - foaled}yo`, h.colour, h.sex, h.gait].filter(Boolean).join(" ").toLowerCase();

  return (
    <>
      <div className="bg-navy text-white">
        <div className="wrap flex flex-col gap-5 py-8 sm:flex-row sm:items-center">
          <div className="grid h-28 w-28 shrink-0 place-items-center bg-white">
            <Silk path={h.colours_image} size={70} title={h.colours} />
          </div>
          <div className="min-w-0">
            <p className="kicker text-amber!">Horse profile{h.country ? ` · ${h.country}` : ""}</p>
            <h1 className="mt-1 font-headline text-4xl font-bold leading-none sm:text-5xl">{h.name}</h1>
            <p className="mt-2 text-[15px] text-white/80">
              {about && <span className="capitalize">{about}</span>}
              {(h.sire || h.dam) && <span> · {h.sire ?? "?"} – {h.dam ?? "?"}</span>}
            </p>
            <p className="mt-1 text-[14px] text-white/70">
              {h.trainer_name && <>Trainer {h.trainer_id ? <Link href={personHref(h.trainer_id)} className="font-semibold text-white underline-offset-2 hover:underline">{h.trainer_name}</Link> : h.trainer_name}</>}
              {h.owner && <> · Owner {h.owner}</>}
            </p>
          </div>
        </div>
      </div>

      <div className="wrap py-7">
        <StatStrip
          items={[
            ["Starts", rec.starts],
            ["Wins", rec.wins],
            ["Seconds", rec.seconds],
            ["Thirds", rec.thirds],
            ["Stakes", money(rec.stakes)],
            ["Best mile rate", raceClock(h.best_mile_rate)],
          ]}
        />
        {!life && <p className="mt-2 text-[12px] text-muted">Record counts the races in our data.</p>}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {upcoming.length > 0 && (
              <section className="mb-8">
                <h2 className="panel-label mb-3">Next start</h2>
                {upcoming.map((r) => (
                  <Link key={r.race_id} href={raceHref(r.race_id)} className="sheet group flex items-center justify-between gap-4 border-l-4 border-l-amber px-4 py-4 hover:bg-mist">
                    <span>
                      <b className="block text-[16px] text-ink group-hover:text-blue">{r.venue} R{r.race_number}</b>
                      <span className="text-[13px] text-muted">{dayLabel(r.meeting_date, { weekday: "long", day: "numeric", month: "long" })}{r.barrier ? ` · Barrier ${r.barrier}` : ""}{r.driver_name ? ` · ${r.driver_name}` : ""}</span>
                    </span>
                    <span className="text-xl text-neutral-300 group-hover:text-navy">›</span>
                  </Link>
                ))}
              </section>
            )}
            <h2 className="panel-label mb-3">Race record</h2>
            <RunList runs={past} focus="horse" />
          </div>
          <aside className="flex flex-col gap-6">
            <section className="sheet p-4">
              <h2 className="panel-label">Details</h2>
              <dl className="mt-3 divide-y divide-line text-[13.5px]">
                {[
                  ["Sire", h.sire], ["Dam", h.dam], ["Foaled", h.foal_date ? dayLabel(h.foal_date, { day: "numeric", month: "short", year: "numeric" }) : foaled],
                  ["Breeder", h.breeder], ["Owner", h.owner], ["Colours", h.colours], ["Rating", h.rating], ["Recent form", h.form_recent],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} className="grid grid-cols-[96px_1fr] gap-3 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
