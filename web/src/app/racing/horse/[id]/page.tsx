import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Silk from "@/components/racing/Silk";
import { FormSquares, Hero, HeroButton, Panel, PlaceSquare, SectionTitle, StatCard } from "@/components/racing/ui";
import { getHorse, getRace } from "@/lib/harnesslink";
import { dayLabel, money, personHref, raceClock, raceHref, todayIn, youtubeId } from "@/lib/racingLinks";

type Props = { params: Promise<{ id: string }> };
const horseId = async (p: Props["params"]) => { const n = Number((await p).id); return Number.isInteger(n) && n > 0 ? n : null; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await horseId(params);
  const h = id ? await getHorse(id) : null;
  return h ? { title: `${h.name} – form and results` } : {};
}

/** Whole years between a YYYY-MM-DD birth date and today. */
function ageOn(birth: string, today: string) {
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return today.slice(5) < birth.slice(5) ? years - 1 : years;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

export default async function HorsePage({ params }: Props) {
  const id = await horseId(params);
  const h = id ? await getHorse(id) : null;
  if (!h) notFound();

  const today = todayIn("Pacific/Auckland");
  const upcoming = h.runs.filter((r) => !r.placing && !r.scratched && r.meeting_date >= today).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const past = h.runs.filter((r) => !upcoming.includes(r) && !r.scratched).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  const latest = past.find((r) => r.placing);
  const latestRace = latest ? await getRace(latest.race_id, true) : null;
  const replay = latestRace && youtubeId(latestRace.video_url) ? `${raceHref(latestRace.id)}#replay` : null;

  // HRNZ's career figures when we have them (whole career), else what we hold.
  const life = h.career.lifetime.find((l) => !l.description || /total|all|life/i.test(l.description)) ?? h.career.lifetime[0];
  const rec = life
    ? { starts: life.starts, wins: life.firsts, seconds: life.seconds, thirds: life.thirds, stakes: life.stakes }
    : { starts: h.record.starts, wins: h.record.wins, seconds: h.record.seconds, thirds: h.record.thirds, stakes: h.record.stakes };
  const foaled = h.foal_date ? Number(h.foal_date.slice(0, 4)) : h.foal_season;
  const age = h.foal_date ? ageOn(h.foal_date, today) : foaled ? Number(today.slice(0, 4)) - foaled : null;
  const about = [
    age != null && `${age}yo`,
    h.colour?.toLowerCase(),
    h.sex?.toLowerCase(),
    h.foal_date && `Foaled ${dayLabel(h.foal_date, { day: "numeric", month: "short", year: "numeric" })}`,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <Hero
        crumbs={[{ label: "Racing", href: "/racing/" }, { label: "Horses" }, { label: h.name }]}
        tags={[h.gait && ({ pace: "Pacer", trot: "Trotter" }[h.gait.toLowerCase()] ?? h.gait)].filter((t): t is string => Boolean(t))}
        title={h.name}
        suffix={h.country}
        media={<Silk path={h.colours_image} size={56} title={h.colours} />}
        lines={[about, h.sire || h.dam ? `${h.sire ?? "Unknown"} – ${h.dam ?? "Unknown"}` : null].filter(Boolean)}
        facts={[
          { label: "Trainer", value: h.trainer_id ? <Link href={personHref(h.trainer_id)} className="hover:underline">{h.trainer_name}</Link> : h.trainer_name ?? "–" },
          { label: "Owner", value: h.owner ?? "–" },
          { label: "Breeder", value: h.breeder ?? "–" },
          ...(h.rating ? [{ label: "Rating", value: h.rating }] : []),
          ...(h.colours ? [{ label: "Colours", value: h.colours }] : []),
        ]}
        actions={replay && <HeroButton href={replay} solid>▶ Watch latest replay</HeroButton>}
      />

      <StatCard
        stats={[
          { label: "Starts", value: rec.starts },
          { label: "Wins", value: rec.wins, accent: true },
          { label: "Seconds", value: rec.seconds },
          { label: "Thirds", value: rec.thirds },
          { label: "Win strike", value: pct(rec.wins, rec.starts) },
          { label: "Top three", value: pct(rec.wins + rec.seconds + rec.thirds, rec.starts) },
          { label: "Best mile rate", value: raceClock(h.best_mile_rate) ?? "–" },
          { label: "Group 1 wins", value: h.group1_wins },
        ]}
        footer={
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-display text-[30px] font-bold leading-none text-ink">{money(rec.stakes) ?? "–"}</p>
              <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{life ? "Career prizemoney" : "Prizemoney (races we hold)"}</p>
            </div>
            <FormSquares runs={past.filter((r) => r.placing).slice(0, 10)} />
          </div>
        }
      />

      <div className="wrap max-w-[1180px]! grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <SectionTitle>Recent form</SectionTitle>
          {past.length ? (
            <div className="overflow-x-auto rounded-md border border-line bg-white">
              <table className="w-full min-w-[560px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
                    <th className="px-4 py-3">Pl</th><th className="px-2 py-3">Date</th><th className="px-2 py-3">Track</th><th className="px-2 py-3">Race</th><th className="px-4 py-3">Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {past.slice(0, 15).map((r) => (
                    <tr key={r.race_id} className="border-b border-line last:border-0 hover:bg-mist">
                      <td className="px-4 py-2.5"><PlaceSquare placing={r.placing} position={r.position} /></td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{dayLabel(r.meeting_date, { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="whitespace-nowrap px-2 py-2.5">{r.venue}</td>
                      <td className="max-w-[340px] truncate px-2 py-2.5"><Link href={raceHref(r.race_id)} className="font-semibold uppercase text-ink hover:text-blue">{r.major_race_name ?? r.race_name ?? `Race ${r.race_number}`}</Link></td>
                      <td className="whitespace-nowrap px-4 py-2.5">{r.driver_id ? <Link href={personHref(r.driver_id)} className="text-navy hover:underline">{r.driver_name}</Link> : r.driver_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md border border-line bg-white px-4 py-8 text-center text-sm text-muted">No runs in our data yet.</p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {upcoming[0] && (
            <Panel title="Next start">
              <Link href={raceHref(upcoming[0].race_id)} className="block font-semibold text-ink hover:text-blue">{upcoming[0].venue} R{upcoming[0].race_number}</Link>
              <p className="text-[13px] text-muted">
                {dayLabel(upcoming[0].meeting_date, { weekday: "long", day: "numeric", month: "long" })}
                {upcoming[0].barrier ? ` · Barrier ${upcoming[0].barrier}` : ""}
              </p>
            </Panel>
          )}
          {(h.sire || h.dam) && (
            <Panel title="Pedigree">
              <div className="grid grid-cols-2 gap-2">
                {[["Sire", h.sire], ["Dam", h.dam]].map(([k, v]) => (
                  <div key={k} className="rounded-[4px] bg-navy px-3 py-2.5 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fb4ff]">{k}</p>
                    <p className="mt-0.5 text-[14px] font-semibold leading-tight">{v ?? "Unknown"}</p>
                  </div>
                ))}
              </div>
              {h.breeder && <p className="mt-2 text-[12px] text-muted">Bred by {h.breeder}</p>}
            </Panel>
          )}
          {h.form_recent && (
            <Panel title="Form figures">
              <p className="font-mono text-[16px] font-semibold tracking-[0.08em] text-ink">{h.form_recent}</p>
              <p className="mt-1 text-[11.5px] text-muted">Oldest to latest; the last figure is the latest start.</p>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
