import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Replay from "@/components/racing/Replay";
import Silk from "@/components/racing/Silk";
import { Hero, Panel, PlaceSquare, SectionTitle, StatCard } from "@/components/racing/ui";
import { getMeeting, getRace, winPrice, type Entry } from "@/lib/harnesslink";
import {
  dayHref, dayLabel, dividendLines, horseHref, money, personHref, raceClock, raceHref, raceTime, youtubeId, type RacingCountry,
} from "@/lib/racingLinks";

type Props = { params: Promise<{ id: string }> };

const raceId = async (params: Props["params"]) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await raceId(params);
  const r = id ? await getRace(id) : null;
  return r ? { title: `${r.venue} R${r.race_number} ${r.name ?? ""}`.trim() } : {};
}

const tenths = (v: string | number | null) => (v == null ? null : Number(v).toFixed(1));

export default async function RacePage({ params }: Props) {
  const id = await raceId(params);
  const race = id ? await getRace(id) : null;
  if (!race) notFound();
  const meeting = await getMeeting(race.meeting_id);
  const tz = race.timezone ?? meeting?.timezone ?? "Pacific/Auckland";
  const country: RacingCountry = (meeting?.country ?? "NZ") === "AU" ? "au" : "nz";
  const done = race.status.startsWith("result");
  const video = youtubeId(race.video_url);
  const date = race.meeting_date ?? meeting?.meeting_date ?? "";
  const runners = [...race.entries].sort((a, b) =>
    a.scratched !== b.scratched ? (a.scratched ? 1 : -1)
      : done ? (a.position ?? 99) - (b.position ?? 99) || (a.saddlecloth ?? 99) - (b.saddlecloth ?? 99)
        : (a.saddlecloth ?? 99) - (b.saddlecloth ?? 99),
  );
  const starters = race.entries.filter((e) => !e.scratched).length;
  const barriers = race.entries.some((e) => e.barrier);
  const races = meeting ? [...meeting.races].sort((a, b) => a.race_number - b.race_number) : [];

  return (
    <>
      <Hero
        crumbs={[
          { label: "Racing", href: "/racing/" },
          { label: `${country === "au" ? "AUS" : "NZ"} ${done ? "results" : "fields"}`, href: dayHref(country, done ? "results" : "fields", date) },
          { label: `${race.venue} · ${date && dayLabel(date)}` },
        ]}
        tags={[race.major_race_name, race.gait, race.start_type, race.class_short].filter((t): t is string => Boolean(t))}
        title={`R${race.race_number} ${race.venue}`}
        lines={[race.name, [date && dayLabel(date, { weekday: "long", day: "numeric", month: "long" }), raceTime(race.start_time, tz), race.distance_m && `${race.distance_m}m`].filter(Boolean).join(" · ")]}
        actions={
          races.length > 1 && (
            <nav className="flex flex-wrap gap-1.5" aria-label="Races at this meeting">
              {races.map((r) => (
                <Link
                  key={r.id}
                  href={raceHref(r.id)}
                  aria-current={r.id === race.id ? "page" : undefined}
                  className={`rounded-[4px] px-2.5 py-1.5 text-center text-[12px] font-bold ${r.id === race.id ? "bg-white text-navy" : "border border-white/30 text-white/80 hover:bg-white/10"}`}
                >
                  R{r.race_number}
                  <span className="ml-1.5 font-semibold opacity-70">{r.status.startsWith("result") ? "✓" : raceTime(r.start_time, tz)}</span>
                </Link>
              ))}
            </nav>
          )
        }
      />

      <StatCard
        stats={
          done
            ? [
                { label: "Winning time", value: raceClock(race.win_time) ?? "–", accent: true },
                { label: "Mile rate", value: raceClock(race.mile_rate) ?? "–" },
                { label: "Last 800m", value: tenths(race.last_800) ?? "–" },
                { label: "Last 400m", value: tenths(race.last_400) ?? "–" },
                { label: "Stake", value: money(race.stakes_total) ?? "–" },
                { label: "Starters", value: starters },
                ...(race.track_condition ? [{ label: "Track", value: race.track_condition }] : []),
              ]
            : [
                { label: "Start", value: raceTime(race.start_time, tz), accent: true },
                { label: "Distance", value: race.distance_m ? `${race.distance_m}m` : "–" },
                { label: "Starters", value: starters },
                { label: "Stake", value: money(race.stakes_total) ?? "–" },
                ...(race.track_condition ? [{ label: "Track", value: race.track_condition }] : []),
              ]
        }
      />

      <div className="wrap max-w-[1180px]! grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {done && video && (
            <section id="replay" className="mb-8 scroll-mt-24 overflow-hidden rounded-md">
              <Replay id={video} title={`${race.venue} R${race.race_number} – ${race.name ?? "replay"}`} />
            </section>
          )}
          <SectionTitle>{done ? "Result" : "Field"}</SectionTitle>
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
                  <th className="px-4 py-3">{done ? "Pl" : "No"}</th>
                  <th className="px-2 py-3">Horse</th>
                  {done ? <th className="px-2 py-3">Margin · time</th> : barriers && <th className="px-2 py-3">Barrier</th>}
                  <th className="px-2 py-3">Driver / trainer</th>
                  <th className="px-4 py-3 text-right">{done ? "SP" : "Fixed"}</th>
                </tr>
              </thead>
              <tbody>
                {runners.map((e) => <Row key={`${e.horse_id}-${e.saddlecloth}`} e={e} done={done} barriers={barriers} />)}
              </tbody>
            </table>
          </div>
          {race.conditions && <p className="mt-4 text-[12px] leading-relaxed text-muted">{race.conditions}</p>}
        </div>

        <aside className="flex flex-col gap-4">
          {done && race.dividends_text && (
            <Panel title={country === "au" ? "Dividends · TAB (AU pools)" : "Dividends · NZ pools"}>
              <ul className="divide-y divide-line text-[13.5px]">
                {dividendLines(race.dividends_text).map((line, i) => <li key={i} className="py-1.5 tabular-nums">{line}</li>)}
              </ul>
            </Panel>
          )}
          {done && !video && (
            <Panel title="Replay">
              <p className="text-[13px] text-muted">
                {country === "au" ? "Replays for Australian races aren't in our data yet." : "The replay appears here once HRNZ publishes it."}
              </p>
            </Panel>
          )}
          <p className="text-[11.5px] text-muted">
            Data: {race.sources.map((s) => s.toUpperCase()).join(" + ") || "HarnessLink"}.{!done && " Fixed odds from TAB; they can change."} Gamble responsibly.
          </p>
        </aside>
      </div>
    </>
  );
}

function Row({ e, done, barriers }: { e: Entry; done: boolean; barriers: boolean }) {
  const price = winPrice(e);
  const move = Number(e.latest_prices.find((p) => p.market_type === "win")?.change_pct ?? 0);
  return (
    <tr className={`border-b border-line align-top last:border-0 ${e.scratched ? "opacity-45" : ""}`}>
      <td className="px-4 py-3">
        {done ? (
          e.scratched ? <span className="text-[11px] font-bold text-muted">SCR</span> : <PlaceSquare placing={e.placing} position={e.position} size="md" />
        ) : (
          <span className="inline-grid h-7 min-w-7 place-items-center rounded-[3px] bg-navy px-1 text-[12px] font-bold text-white">{e.saddlecloth ?? "–"}</span>
        )}
      </td>
      <td className="px-2 py-3">
        <div className="flex items-start gap-2.5">
          <Silk path={e.colours_image} size={24} title={e.colours} />
          <div className="min-w-0">
            <Link href={horseHref(e.horse_id)} className={`font-semibold text-ink hover:text-blue ${e.scratched ? "line-through" : ""}`}>
              {done && e.saddlecloth != null && <span className="font-normal text-muted">{e.saddlecloth}. </span>}
              {e.horse_name}
            </Link>
            {!done && e.form && <p className="text-[12px] tabular-nums text-muted">Form {e.form}</p>}
            {done && e.review_comment && <p className="max-w-[320px] text-[12px] italic text-muted">{e.review_comment}</p>}
          </div>
        </div>
      </td>
      {(done || barriers) && <td className="whitespace-nowrap px-2 py-3 tabular-nums">
        {done
          ? [e.position && e.position > 1 && e.margin_lengths != null ? `${Number(e.margin_lengths)}L` : null, raceClock(e.horse_time)].filter(Boolean).join(" · ") || ""
          : <>{e.barrier ?? "–"}{e.handicap_m ? <span className="text-muted"> ({e.handicap_m}m)</span> : null}</>}
        {done && Number(e.stakes_won) > 0 && <span className="block text-[12px] text-muted">{money(e.stakes_won)}</span>}
      </td>}
      <td className="px-2 py-3 text-[13px]">
        {e.driver_id ? <Link href={`${personHref(e.driver_id)}?as=driver`} className="font-semibold text-navy hover:underline">{e.driver_name}</Link> : e.driver_name ?? "TBA"}
        <span className="block text-muted">
          {e.trainer_id ? <Link href={`${personHref(e.trainer_id)}?as=trainer`} className="hover:underline">{e.trainer_name}</Link> : e.trainer_name}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {!e.scratched && price && (
          <>
            <span className="font-display text-[19px] font-bold tabular-nums text-ink">${price.toFixed(2)}</span>
            {!done && move !== 0 && Number.isFinite(move) && (
              <span className={`block text-[11px] font-bold tabular-nums ${move < 0 ? "text-[#1f7a44]" : "text-red"}`}>{move < 0 ? "▼" : "▲"} {Math.abs(Math.round(move))}%</span>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
