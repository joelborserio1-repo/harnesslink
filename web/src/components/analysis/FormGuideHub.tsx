"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormGuideBest, FormGuideCard, FormGuidePick, FormGuideRace } from "@/lib/api";
import { money, ordinal, raceTitle, type Live } from "@/lib/analysis";
import { Silk } from "./SpeedMap";
import { SkyIcon } from "./RaceWeather";

// /form-guide/: every AU/NZ meeting today on one page. Next to go across all
// tracks, the Harness Analyst's best bets, then race by race for each meeting
// with our three picks, fixed prices and results as they come in (the same
// live feed as the cards, every two minutes), and how yesterday's tips went.

const LIVE_MS = 120_000;
const COUNTRY: Record<string, string> = { AU: "Australia", NZ: "New Zealand" };

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const timeAt = (iso: string | null, tz: string) =>
  iso ? new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso)).replace(" ", "") : "";
const winDividend = (d: string | null | undefined) => d?.match(/Win \$([\d.]+)/)?.[1] || null;
const startBits = (r: FormGuideRace) =>
  [r.distance ? `${r.distance}m` : null, r.start === "standing" ? "standing" : r.start === "mobile" ? "mobile" : null, r.gait === "trot" ? "trot" : null]
    .filter(Boolean)
    .join(" · ");

function useLiveAll(ids: number[]) {
  const [live, setLive] = useState<Record<number, Live>>({});
  const key = ids.join(",");
  useEffect(() => {
    let stop = false;
    const load = () =>
      key.split(",").filter(Boolean).forEach((id) =>
        fetch(`/api/race-analysis/live/${id}/`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => !stop && d && setLive((x) => ({ ...x, [id]: d })))
          .catch(() => {})
      );
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), LIVE_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [key]);
  return live;
}

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now;
}

type RaceLive = Live["races"][string] | undefined;
const raceLive = (live: Record<number, Live>, c: FormGuideCard, r: { id: number }): RaceLive => live[c.meetingId]?.races?.[r.id];
const price = (rl: RaceLive, p: FormGuidePick) => {
  const e = rl?.entries?.[p.no];
  return e?.win ?? p.win;
};
const scratched = (rl: RaceLive, no: number) => !!rl?.entries?.[no]?.scratched;
const placing = (rl: RaceLive, no: number) => Number(rl?.entries?.[no]?.placing) || 0;
const winnerNo = (rl: RaceLive) => Number(Object.entries(rl?.entries || {}).find(([, e]) => e.placing === "1")?.[0]) || 0;

function Outcome({ n }: { n: number }) {
  if (!n) return null;
  return <span className={`fg-outcome${n === 1 ? " is-won" : n <= 3 ? " is-placed" : ""}`}>{n === 1 ? "Won" : ordinal(n)}</span>;
}

function Countdown({ iso, now, tz }: { iso: string; now: number | null; tz: string }) {
  if (now == null) return <>{timeAt(iso, tz)}</>;
  const mins = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (mins <= 0) return <>Jumping</>;
  if (mins < 60) return <>{mins} min</>;
  return (
    <>
      {Math.floor(mins / 60)}h {String(mins % 60).padStart(2, "0")}m
    </>
  );
}

// ---------- next to go ----------

function NextToGo({ cards, live, now }: { cards: FormGuideCard[]; live: Record<number, Live>; now: number | null }) {
  const next = useMemo(() => {
    if (now == null) return []; // known only in the browser
    const t = now;
    return cards
      .flatMap((c) => c.races.map((r) => ({ c, r })))
      .filter(({ c, r }) => r.startTime && !raceLive(live, c, r)?.resulted && new Date(r.startTime).getTime() > t - 3 * 60_000)
      .sort((a, b) => a.r.startTime!.localeCompare(b.r.startTime!))
      .slice(0, 4);
  }, [cards, live, now]);
  if (!next.length) return null;
  return (
    <section className="fg-next" aria-label="Next to go">
      <h2 className="fg-section-h">Next to go</h2>
      <ol className="fg-next-list">
        {next.map(({ c, r }) => {
          const top = r.picks.find((p) => !scratched(raceLive(live, c, r), p.no));
          return (
            <li key={r.id}>
              <Link href={`${c.path}#race-${r.no}`} className="fg-next-item">
                <span className="fg-next-when">
                  <Countdown iso={r.startTime!} now={now} tz={c.timezone} />
                </span>
                <span className="fg-next-race">
                  <strong>
                    {c.venue} R{r.no}
                  </strong>{" "}
                  <span>
                    Jumps {timeAt(r.startTime, c.timezone)} local · {startBits(r)}
                  </span>
                </span>
                {top && (
                  <span className="fg-next-pick">
                    <Silk path={top.silk} colours={top.colours} alt="" size={28} />
                    <span>
                      <span className="fg-label">Our pick</span>
                      {top.horse} ({top.no}) <span className="fg-price">{money(price(raceLive(live, c, r), top))}</span>
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------- best bets ----------

function BestCell({ c, b, kind, live }: { c: FormGuideCard; b: FormGuideBest | null; kind: "bet" | "value"; live: Record<number, Live> }) {
  if (!b) return <td className="fg-muted">–</td>;
  const rl = raceLive(live, c, { id: b.raceId });
  const n = placing(rl, b.no);
  const div = n === 1 ? winDividend(rl?.dividends) : null;
  return (
    <td className={`fg-bestcell fg-bestcell-${kind}`}>
      <Link href={`${c.path}#race-${b.race}`}>
        <Silk path={b.silk} colours={b.colours} alt="" size={kind === "bet" ? 36 : 28} />
        <span className="fg-bestcell-body">
          <strong>
            {b.horse} <span className="fg-no">({b.no})</span>
          </strong>
          <span className="fg-bestcell-sub">
            R{b.race} · {timeAt(b.startTime, c.timezone)} ·{" "}
            {rl?.resulted ? (div ? <span className="fg-price">Paid ${div}</span> : "Run") : <span className="fg-price">{money(price(rl, b))}</span>}
          </span>
          {kind === "bet" && b.comment && <span className="fg-bestcell-comment">{b.comment}</span>}
        </span>
        <Outcome n={n} />
      </Link>
    </td>
  );
}

function BestBets({ cards, live }: { cards: FormGuideCard[]; live: Record<number, Live> }) {
  const rows = cards.filter((c) => c.bestBet || c.bestValue);
  if (!rows.length) return null;
  return (
    <section className="fg-bests">
      <h2 className="fg-section-h">Harness Analyst best bets today</h2>
      <table className="fg-besttable">
        <thead>
          <tr>
            <th scope="col">Meeting</th>
            <th scope="col">Best bet</th>
            <th scope="col">Best value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.slug}>
              <th scope="row">
                <a href={`#${c.slug}`}>{c.venue}</a>
                <span>First race {timeAt(c.firstRace, c.timezone)}</span>
              </th>
              <BestCell c={c} b={c.bestBet} kind="bet" live={live} />
              <BestCell c={c} b={c.bestValue} kind="value" live={live} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- a meeting, race by race ----------

function Weather({ l }: { l: Live | undefined }) {
  const w = l?.weather;
  if (!w || w.temp == null) return null;
  return (
    <span className="fg-weather" title={w.place}>
      <SkyIcon code={w.code} size={26} />
      <span>
        {Math.round(w.temp)}°{w.rainChance != null ? ` · ${w.rainChance}% rain` : ""}
      </span>
    </span>
  );
}

function tally(c: FormGuideCard, live: Record<number, Live>) {
  let run = 0,
    top = 0,
    any = 0;
  for (const r of c.races) {
    const rl = raceLive(live, c, r);
    if (!rl?.resulted || !r.picks.length) continue;
    run++;
    const w = winnerNo(rl);
    if (r.picks[0]?.no === w) top++;
    if (r.picks.some((p) => p.no === w)) any++;
  }
  return { run, top, any };
}

function MeetingBlock({ c, live }: { c: FormGuideCard; live: Record<number, Live> }) {
  const l = live[c.meetingId];
  const t = tally(c, live);
  const bb = c.bestBet ? placing(raceLive(live, c, { id: c.bestBet.raceId }), c.bestBet.no) : 0;
  const bbRun = c.bestBet ? !!raceLive(live, c, { id: c.bestBet.raceId })?.resulted : false;
  return (
    <section className="fg-meeting" id={c.slug}>
      <header className="fg-meeting-head">
        <div>
          <h3 className="fg-meeting-h">
            <Link href={c.path}>{c.venue}</Link>
          </h3>
          <p className="fg-meeting-meta">
            {c.races.length} races · first race {timeAt(c.firstRace, c.timezone)} local
            {(l?.trackCondition || c.trackCondition) && <> · track {(l?.trackCondition || c.trackCondition)!.toLowerCase()}</>}
          </p>
        </div>
        <Weather l={l} />
        <Link href={c.path} className="fg-meeting-go">
          Full form guide <span aria-hidden>→</span>
        </Link>
      </header>
      {t.run > 0 && (
        <p className="fg-tally">
          <strong>Our tips:</strong> top pick won {t.top} of {t.run}, winner among our three picks in {t.any} of {t.run}
          {bbRun && c.bestBet ? `. Best bet ${c.bestBet.horse} ${bb === 1 ? "won" : bb ? `ran ${ordinal(bb)}` : "missed the places"}` : ""}.
        </p>
      )}
      <table className="fg-races">
        <thead>
          <tr>
            <th scope="col">Race</th>
            <th scope="col">Our tips</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {c.races.map((r) => {
            const rl = raceLive(live, c, r);
            const w = winnerNo(rl);
            const div = winDividend(rl?.dividends);
            return (
              <tr key={r.id} className={rl?.resulted ? "is-run" : ""}>
                <td className="fg-races-race">
                  <Link href={`${c.path}#race-${r.no}`}>
                    <strong>R{r.no}</strong> <span className="fg-time">{timeAt(r.startTime, c.timezone)}</span>
                    <span className="fg-race-name">{raceTitle(r.name)}</span>
                    <span className="fg-race-meta">
                      {startBits(r)}
                      {r.starters ? ` · ${r.starters} starters` : ""}
                    </span>
                  </Link>
                </td>
                <td className="fg-races-picks">
                  {r.picks.length ? (
                    <ol>
                      {r.picks.map((p, i) => {
                        const n = placing(rl, p.no);
                        const scr = scratched(rl, p.no);
                        return (
                          <li key={p.no} className={`${i === 0 ? "is-top" : ""}${scr ? " is-scratched" : ""}`}>
                            <Silk path={p.silk} colours={p.colours} alt="" size={22} />
                            <span>
                              {p.horse} <span className="fg-no">({p.no})</span>
                            </span>
                            {scr ? <span className="fg-scr">Scratched</span> : n ? <Outcome n={n} /> : !rl?.resulted && <span className="fg-price fg-pick-price">{money(price(rl, p))}</span>}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <span className="fg-muted">Tips to come</span>
                  )}
                </td>
                <td className="fg-races-result">
                  {rl?.resulted && w ? (
                    <>
                      <span className="fg-label">1st</span> {r.names[w] || `No. ${w}`} ({w})
                      {div && <span className="fg-div">${div}</span>}
                    </>
                  ) : r.startTime ? (
                    <span className="fg-muted">Jumps {timeAt(r.startTime, c.timezone)}</span>
                  ) : (
                    <span className="fg-muted">–</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ---------- the page ----------

export default function FormGuideHub({ cards, today }: { cards: FormGuideCard[]; today: string }) {
  const todays = cards.filter((c) => c.date === today);
  const ahead = cards.filter((c) => c.date > today);
  const past = cards.filter((c) => c.date < today);
  const pastDays = [...new Set(past.map((c) => c.date))].sort().reverse();
  const live = useLiveAll(cards.map((c) => c.meetingId));
  const now = useNow();

  const byCountry = (list: FormGuideCard[]) => ["NZ", "AU"].map((k) => [k, list.filter((c) => c.country === k)] as const).filter(([, l]) => l.length);

  return (
    <>
      {todays.length > 0 && (
        <nav className="fg-jump" aria-label="Today's meetings">
          <span className="fg-label">Today</span>
          {todays.map((c) => (
            <a key={c.slug} href={`#${c.slug}`}>
              {c.venue} <span>{timeAt(c.firstRace, c.timezone)}</span>
            </a>
          ))}
        </nav>
      )}

      <NextToGo cards={todays} live={live} now={now} />

      <BestBets cards={todays} live={live} />

      {todays.length > 0 ? (
        <section>
          <h2 className="fg-day-h">Today, {dayLabel(today)}</h2>
          {byCountry(todays).map(([k, list]) => (
            <div key={k} className="fg-country">
              <h3 className="fg-country-h">{COUNTRY[k] || k}</h3>
              {list.map((c) => (
                <MeetingBlock key={c.slug} c={c} live={live} />
              ))}
            </div>
          ))}
        </section>
      ) : (
        <p className="fg-empty">Today&rsquo;s cards are published from 7am NZ time on race days.</p>
      )}

      {ahead.length > 0 && (
        <section className="fg-later">
          <h2 className="fg-day-h">Coming up</h2>
          {ahead.map((c) => (
            <MeetingBlock key={c.slug} c={c} live={live} />
          ))}
        </section>
      )}

      {pastDays.map((d) => (
        <section key={d} className="fg-past">
          <h2 className="fg-day-h">{dayLabel(d)}: how our tips went</h2>
          {past
            .filter((c) => c.date === d)
            .map((c) => (
              <MeetingBlock key={c.slug} c={c} live={live} />
            ))}
        </section>
      ))}
    </>
  );
}
