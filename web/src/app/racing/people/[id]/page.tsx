import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Silk from "@/components/racing/Silk";
import { Hero, HeroButton, Panel, PlaceSquare, PlacingsDonut, SectionTitle, StatCard } from "@/components/racing/ui";
import { getPerson, type RunLine } from "@/lib/harnesslink";
import { dayLabel, horseHref, money, personHref, raceHref, todayIn } from "@/lib/racingLinks";

type Role = "driver" | "trainer";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> };
const personId = async (p: Props["params"]) => { const n = Number((await p).id); return Number.isInteger(n) && n > 0 ? n : null; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await personId(params);
  const p = id ? await getPerson(id) : null;
  return p ? { title: `${p.name} – results and upcoming` } : {};
}

function tally(runs: RunLine[]) {
  const ran = runs.filter((r) => r.placing && !r.scratched);
  const at = (n: number) => ran.filter((r) => r.position === n).length;
  const [wins, seconds, thirds] = [at(1), at(2), at(3)];
  return { starts: ran.length, wins, seconds, thirds, other: ran.length - wins - seconds - thirds, stakes: ran.reduce((s, r) => s + Number(r.stakes_won ?? 0), 0) };
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "–");

export default async function PersonPage({ params, searchParams }: Props) {
  const id = await personId(params);
  const p = id ? await getPerson(id) : null;
  if (!p) notFound();

  const drives = p.runs.filter((r) => r.driver_id === p.id);
  const trains = p.runs.filter((r) => r.trainer_id === p.id);
  const asked = (await searchParams).as;
  const role: Role = asked === "trainer" || asked === "driver" ? asked : drives.length >= trains.length ? "driver" : "trainer";
  const other: Role = role === "driver" ? "trainer" : "driver";
  const mine = role === "driver" ? drives : trains;
  const hasOther = (role === "driver" ? trains : drives).length > 0;

  const today = todayIn("Pacific/Auckland");
  const year = today.slice(0, 4);
  const upcoming = mine.filter((r) => !r.placing && !r.scratched && r.meeting_date >= today).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || a.race_number - b.race_number);
  const results = mine.filter((r) => r.placing && !r.scratched).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  const all = tally(mine);
  const thisYear = tally(mine.filter((r) => r.meeting_date.startsWith(year)));

  // Horses this person drives or trains most, from the runs we hold.
  const horses = [...results.reduce((m, r) => {
    const h = m.get(r.horse_id) ?? { id: r.horse_id, name: r.horse_name, silk: r.colours_image, starts: 0, wins: 0 };
    h.starts += 1; h.wins += r.position === 1 ? 1 : 0;
    return m.set(r.horse_id, h);
  }, new Map<number, { id: number; name: string; silk: string | null; starts: number; wins: number }>()).values()]
    .sort((a, b) => b.wins - a.wins || b.starts - a.starts)
    .slice(0, 8);

  const roleLabel = role === "driver" ? "Driver" : "Trainer";

  return (
    <>
      <Hero
        crumbs={[{ label: "Racing", href: "/racing/" }, { label: role === "driver" ? "Drivers" : "Trainers" }, { label: p.name }]}
        tags={[roleLabel]}
        title={p.name}
        lines={[p.racebook_name !== p.name ? p.racebook_name : null, p.locality ? `Based at ${p.locality}` : null].filter(Boolean)}
        actions={hasOther && <HeroButton href={`${personHref(p.id)}?as=${other}`}>View {other} profile</HeroButton>}
      />

      <StatCard
        stats={[
          { label: "Starts", value: all.starts },
          { label: "Wins", value: all.wins, accent: true },
          { label: "Seconds", value: all.seconds },
          { label: "Thirds", value: all.thirds },
          { label: "Win %", value: pct(all.wins, all.starts) },
          { label: "Place %", value: pct(all.wins + all.seconds + all.thirds, all.starts) },
          { label: "Stakes", value: money(all.stakes) ?? "–" },
          { label: "Upcoming", value: upcoming.length },
        ]}
        footer={<p className="text-[11.5px] text-muted">Counts cover the races in our data, not a full career.</p>}
      />

      <div className="wrap max-w-[1180px]! py-8">
        <SectionTitle>{role === "driver" ? "Driving" : "Training"} performance</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <PlacingsDonut title={`${year} · all tracks`} wins={thisYear.wins} seconds={thisYear.seconds} thirds={thisYear.thirds} other={thisYear.other} />
          <PlacingsDonut title="All races we hold" wins={all.wins} seconds={all.seconds} thirds={all.thirds} other={all.other} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {upcoming.length > 0 && (
              <section className="mb-8">
                <SectionTitle>{role === "driver" ? "Upcoming drives" : "Upcoming runners"}</SectionTitle>
                <ul className="divide-y divide-line rounded-md border border-line bg-white">
                  {upcoming.map((r) => (
                    <li key={`${r.race_id}-${r.horse_id}`} className="flex items-center gap-3 px-4 py-3">
                      <Silk path={r.colours_image} size={22} />
                      <div className="min-w-0 flex-1">
                        <Link href={horseHref(r.horse_id)} className="font-semibold text-ink hover:text-blue">{r.horse_name}</Link>
                        <p className="truncate text-[12.5px] text-muted">{r.barrier ? `Barrier ${r.barrier}` : ""}</p>
                      </div>
                      <Link href={raceHref(r.race_id)} className="text-right text-[13px] hover:text-blue">
                        <b className="block">{r.venue} R{r.race_number}</b>
                        <span className="text-muted">{dayLabel(r.meeting_date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <SectionTitle>Results</SectionTitle>
            {results.length ? (
              <div className="overflow-x-auto rounded-md border border-line bg-white">
                <table className="w-full min-w-[560px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
                      <th className="px-4 py-3">Pl</th><th className="px-2 py-3">Date</th><th className="px-2 py-3">Track</th><th className="px-2 py-3">Horse</th><th className="px-4 py-3 text-right">Stake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 25).map((r) => (
                      <tr key={`${r.race_id}-${r.horse_id}`} className="border-b border-line last:border-0 hover:bg-mist">
                        <td className="px-4 py-2.5"><Link href={raceHref(r.race_id)}><PlaceSquare placing={r.placing} position={r.position} /></Link></td>
                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{dayLabel(r.meeting_date, { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="whitespace-nowrap px-2 py-2.5"><Link href={raceHref(r.race_id)} className="hover:text-blue">{r.venue} R{r.race_number}</Link></td>
                        <td className="px-2 py-2.5"><Link href={horseHref(r.horse_id)} className="font-semibold text-navy hover:underline">{r.horse_name}</Link></td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{Number(r.stakes_won) > 0 ? money(r.stakes_won) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-line bg-white px-4 py-8 text-center text-sm text-muted">No results in our data yet.</p>
            )}
          </div>

          <aside>
            {horses.length > 0 && (
              <Panel title={role === "driver" ? "Horses driven" : "Stable"}>
                <ul className="divide-y divide-line">
                  {horses.map((h) => (
                    <li key={h.id} className="flex items-center gap-2.5 py-2">
                      <Silk path={h.silk} size={18} />
                      <Link href={horseHref(h.id)} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink hover:text-blue">{h.name}</Link>
                      <span className="text-[12px] tabular-nums text-muted">{h.wins}/{h.starts}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
