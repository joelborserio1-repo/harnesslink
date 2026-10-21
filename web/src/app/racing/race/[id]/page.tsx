import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Replay from "@/components/racing/Replay";
import Silk from "@/components/racing/Silk";
import { getMeeting, getRace, winPrice, type Entry, type RaceDetail } from "@/lib/harnesslink";
import {
  dayHref, dayLabel, dividendLines, horseHref, money, ordinal, personHref, raceClock, raceHref, raceTime, youtubeId, type RacingCountry,
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
  const facts = [
    raceTime(race.start_time, tz),
    race.distance_m && `${race.distance_m}m`,
    race.gait,
    race.start_type,
    race.class_short,
    money(race.stakes_total),
    race.track_condition && `Track: ${race.track_condition}`,
  ].filter(Boolean);

  const runners = [...race.entries].sort((a, b) =>
    a.scratched !== b.scratched ? (a.scratched ? 1 : -1)
      : done ? (a.position ?? 99) - (b.position ?? 99) || (a.saddlecloth ?? 99) - (b.saddlecloth ?? 99)
        : (a.saddlecloth ?? 99) - (b.saddlecloth ?? 99),
  );

  return (
    <>
      <div className="bg-navy text-white">
        <div className="wrap py-6">
          <nav className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60" aria-label="Breadcrumb">
            <Link href={dayHref(country, done ? "results" : "fields", date)} className="hover:text-white">
              {country === "au" ? "AUS" : "NZ"} {done ? "results" : "fields"}
            </Link>
            <span className="mx-2">/</span>
            <span>{race.venue} · {date && dayLabel(date)}</span>
          </nav>
          <div className="mt-3 flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center bg-amber text-xl font-extrabold text-[#1d1500]">R{race.race_number}</span>
            <div className="min-w-0">
              {race.major_race_name && <p className="kicker text-amber!">{race.major_race_name}</p>}
              <h1 className="font-headline text-2xl font-bold leading-tight sm:text-3xl">{race.name ?? `Race ${race.race_number}`}</h1>
              <p className="mt-1.5 text-[14px] text-white/75">{facts.join(" · ")}</p>
            </div>
          </div>
        </div>
        {meeting && meeting.races.length > 1 && (
          <div className="border-t border-white/15">
            <ol className="wrap flex overflow-x-auto [scrollbar-width:none]">
              {[...meeting.races].sort((a, b) => a.race_number - b.race_number).map((r) => (
                <li key={r.id} className="shrink-0">
                  <Link
                    href={raceHref(r.id)}
                    aria-current={r.id === race.id ? "page" : undefined}
                    className={`flex flex-col items-center border-b-[3px] px-3.5 py-2 ${r.id === race.id ? "border-amber bg-white/10" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"}`}
                  >
                    <span className="text-[14px] font-extrabold">R{r.race_number}</span>
                    <span className="text-[10.5px] font-semibold tabular-nums text-white/55">
                      {r.status.startsWith("result") ? "Result" : raceTime(r.start_time, tz)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="wrap grid gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {done && video && (
            <section id="replay" className="mb-7 scroll-mt-24">
              <Replay id={video} title={`${race.venue} R${race.race_number} – ${race.name ?? "replay"}`} />
            </section>
          )}
          <h2 className="panel-label mb-3">{done ? "Result" : "Field"}</h2>
          <ol className="sheet divide-y divide-line">
            {runners.map((e) => (
              <RunnerRow key={`${e.horse_id}-${e.saddlecloth}`} e={e} done={done} />
            ))}
          </ol>
          {race.conditions && <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{race.conditions}</p>}
        </div>

        <aside className="flex flex-col gap-6">
          {done && <RaceFigures race={race} />}
          {done && race.dividends_text && (
            <section className="sheet p-4">
              <h2 className="panel-label">Dividends</h2>
              <p className="mt-1 text-[11.5px] text-muted">{country === "au" ? "TAB (Australian pools)" : "New Zealand pools"}</p>
              <ul className="mt-3 divide-y divide-line text-[13.5px]">
                {dividendLines(race.dividends_text).map((line, i) => (
                  <li key={i} className="py-1.5 tabular-nums">{line}</li>
                ))}
              </ul>
            </section>
          )}
          {done && !video && (
            <p className="sheet p-4 text-[13px] text-muted">
              {country === "au" ? "Replays for Australian races aren't in our data yet." : "The replay will appear here once HRNZ publishes it."}
            </p>
          )}
          <p className="text-[11.5px] text-muted">
            Data: {race.sources.map((s) => s.toUpperCase()).join(" + ") || "HarnessLink"}. {!done && "Fixed odds from TAB, last updated by HarnessLink's 30-minute refresh. "}Gamble responsibly.
          </p>
        </aside>
      </div>
    </>
  );
}

function RaceFigures({ race }: { race: RaceDetail }) {
  const items = [
    ["Winning time", raceClock(race.win_time)],
    ["Mile rate", raceClock(race.mile_rate)],
    ["Last 800m", race.last_800 != null ? `${Number(race.last_800).toFixed(1)}` : null],
    ["Last 400m", race.last_400 != null ? `${Number(race.last_400).toFixed(1)}` : null],
  ].filter(([, v]) => v);
  if (!items.length) return null;
  return (
    <section className="grid grid-cols-2 border border-line bg-white">
      {items.map(([k, v]) => (
        <div key={k} className="border-b border-r border-line p-4 [&:nth-child(2n)]:border-r-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{k}</p>
          <p className="mt-1 font-headline text-2xl font-bold tabular-nums text-navy">{v}</p>
        </div>
      ))}
    </section>
  );
}

function RunnerRow({ e, done }: { e: Entry; done: boolean }) {
  const price = winPrice(e);
  const move = Number(e.latest_prices.find((p) => p.market_type === "win")?.change_pct ?? 0);
  const placed = done && e.position != null;
  return (
    <li className={`grid grid-cols-[44px_1fr_auto] gap-x-3 gap-y-1 px-4 py-3.5 ${e.scratched ? "opacity-45" : ""} ${placed && e.position === 1 ? "bg-[#fbf6ea]" : ""}`}>
      <div className="flex flex-col items-center gap-1">
        {done ? (
          <span className={`text-[15px] font-extrabold ${e.position === 1 ? "text-accent" : "text-navy"}`}>{e.scratched ? "SCR" : placed ? ordinal(e.position!) : e.placing ?? "–"}</span>
        ) : (
          <span className="grid h-9 w-9 place-items-center bg-navy text-[14px] font-extrabold text-white">{e.saddlecloth ?? "–"}</span>
        )}
        {done && e.saddlecloth != null && <span className="text-[11px] font-bold tabular-nums text-muted">#{e.saddlecloth}</span>}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <Silk path={e.colours_image} size={26} title={e.colours} />
          <div className="min-w-0">
            <Link href={horseHref(e.horse_id)} className={`block truncate text-[15.5px] font-bold text-ink hover:text-blue ${e.scratched ? "line-through" : ""}`}>
              {e.horse_name}
            </Link>
            <p className="truncate text-[12.5px] text-muted">
              {!done && e.barrier && <span>Barrier <b className="text-ink">{e.barrier}</b>{e.handicap_m ? ` (${e.handicap_m}m)` : ""} · </span>}
              {!done && e.form && <span>Form <b className="tabular-nums text-ink">{e.form}</b></span>}
              {done && [e.margin_lengths != null && Number(e.margin_lengths) > 0 && `${Number(e.margin_lengths)}L`, raceClock(e.horse_time), e.mile_rate != null && `MR ${raceClock(e.mile_rate)}`, money(e.stakes_won)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[13px] text-ink">
          <span className="text-muted">D </span>
          {e.driver_id ? <Link href={personHref(e.driver_id)} className="font-semibold text-navy hover:underline">{e.driver_name}</Link> : e.driver_name ?? "TBA"}
          {e.driver_is_junior && <span className="ml-1 text-[11px] font-bold text-accent">(Jnr)</span>}
          <span className="mx-2 text-line">|</span>
          <span className="text-muted">T </span>
          {e.trainer_id ? <Link href={personHref(e.trainer_id)} className="font-semibold text-navy hover:underline">{e.trainer_name}</Link> : e.trainer_name ?? "–"}
        </p>
        {done && e.review_comment && <p className="mt-1 text-[12.5px] italic text-muted">{e.review_comment}</p>}
      </div>

      <div className="text-right">
        {!e.scratched && price && (
          <>
            <span className="inline-block min-w-[62px] bg-mist px-2.5 py-1.5 text-center text-[14px] font-extrabold tabular-nums text-ink">${price.toFixed(2)}</span>
            {!done && move !== 0 && Number.isFinite(move) && (
              <span className={`mt-1 block text-[11px] font-bold tabular-nums ${move < 0 ? "text-[#1f7a44]" : "text-red"}`}>
                {move < 0 ? "▼" : "▲"} {Math.abs(Math.round(move))}%
              </span>
            )}
            {done && <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Fixed</span>}
          </>
        )}
      </div>
    </li>
  );
}
