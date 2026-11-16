"use client";

import { useEffect, useMemo, useState } from "react";
import {
  money,
  ordinal,
  raceTime,
  raceTitle,
  startLabel,
  type Entry,
  type Live,
  type Race,
  type RaceAnalysis as Data,
} from "@/lib/analysis";
import SpeedMap, { DrawnSilks, Silk } from "./SpeedMap";
import TrackGuide, { type Track } from "./TrackGuide";
import RaceWeather from "./RaceWeather";

// The Harness Analyst form guide, read as part of the story: the meeting at a
// glance, best bet and best value, the tipsheet, then race by race the
// analyst's selections, with the speed map and the full field underneath.
// Horses are shown by their silks; the number sits in brackets after the name,
// as in the analyst's copy. Prices, scratchings and results refresh from the
// CMS every two minutes. All of it is server-rendered, so search engines read it.

const LIVE_MS = 120_000;

function useLive(meetingId: number) {
  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/race-analysis/live/${meetingId}/`) // trailing slash: the site adds one
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !stop && d && setLive(d))
        .catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), LIVE_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [meetingId]);
  return live;
}

// The pulled race with whatever the live feed has since.
function withLive(r: Race, live: Live | null): Race {
  const l = live?.races?.[r.id];
  if (!l) return r;
  return {
    ...r,
    status: l.status ?? r.status,
    resulted: l.resulted || r.resulted,
    dividends: l.dividends ?? r.dividends,
    entries: r.entries.map((e) => {
      const x = l.entries?.[e.no];
      return x ? { ...e, win: x.win ?? e.win, place: x.place ?? e.place, toteWin: x.toteWin ?? e.toteWin, scratched: x.scratched, placing: x.placing ?? e.placing, margin: x.margin ?? e.margin } : e;
    }),
  };
}

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

// "Arose (1)": the horse with its number, as the analyst writes it.
function HorseName({ e, strong = true }: { e: Entry; strong?: boolean }) {
  return (
    <span className="ra-name">
      {strong ? <strong>{e.horse}</strong> : e.horse} <span className="ra-no">({e.no})</span>
    </span>
  );
}

function Outcome({ placing }: { placing: string | null }) {
  const n = Number(placing);
  if (!n) return null;
  return <span className={`ra-outcome${n === 1 ? " is-won" : n <= 3 ? " is-placed" : ""}`}>{n === 1 ? "Won" : ordinal(n)}</span>;
}

export default function RaceAnalysis({ data, track }: { data: Data; track?: Track | null }) {
  const { meeting } = data;
  const live = useLive(meeting.id);
  const races = useMemo(() => meeting.races.map((r) => withLive(r, live)), [meeting.races, live]);
  const find = (sel?: { race: number; no: number } | null) => {
    if (!sel) return null;
    const race = races.find((r) => r.no === sel.race);
    const entry = race?.entries.find((e) => e.no === sel.no);
    return race && entry ? { race, entry, comment: data.notes[race.id]?.picks?.find((p) => p.no === entry.no)?.comment || null } : null;
  };
  const best = find(data.bestBet);
  const value = find(data.bestValue);
  const first = races.find((r) => r.startTime);
  const resulted = races.filter((r) => r.resulted);
  const tally = resulted.reduce(
    (acc, r) => {
      const top = data.notes[r.id]?.picks?.[0];
      const e = top && r.entries.find((x) => x.no === top.no);
      if (e?.placing === "1") acc.won++;
      if (e && Number(e.placing) >= 1 && Number(e.placing) <= 3) acc.placed++;
      if (top) acc.tipped++;
      return acc;
    },
    { won: 0, placed: 0, tipped: 0 }
  );
  const drawn = Date.parse(`${meeting.date}T00:00:00Z`) < Date.now() - 2 * 86_400_000;
  const hasTips = races.some((r) => (data.notes[r.id]?.picks || []).length > 0);
  const condition = live?.trackCondition || meeting.trackCondition || null;
  const facts = [
    `${races.length} races`,
    first && `first race ${raceTime(first, meeting.timezone)}`,
    condition && `track ${condition.toLowerCase()}`,
    tally.tipped > 0 && resulted.length > 0 && `our top tips: ${tally.won} won, ${tally.placed} placed`,
  ].filter(Boolean) as string[];

  return (
    <DrawnSilks.Provider value={drawn}>
      <section className="ra" aria-label={`${meeting.venue} race analysis`}>
        <header className="ra-intro">
          <p className="kicker">{hasTips ? "Harness Analyst" : "Form guide"}</p>
          <h2>
            {meeting.venue} {hasTips ? "selections" : "form guide"}, {longDate(meeting.date)}
          </h2>
          <p className="ra-facts">{facts.join(" · ")}</p>
        </header>

        <RaceWeather weather={live?.weather ?? null} firstRace={first ? raceTime(first, meeting.timezone) : null} condition={condition} />

        {(best || value) && (
          <>
            <h3 className="ra-h">Harness analyst best tips</h3>
            <div className="ra-best">
              {best && <BestTip label="Best bet" {...best} />}
              {value && <BestTip label="Best value" {...value} />}
            </div>
          </>
        )}

        <RaceIndex races={races} data={data} tz={meeting.timezone} hasTips={hasTips} />

        {track && (
          <details className="ra-fold">
            <summary>
              <span>Track guide: {track.name}</span>
              <small>3D map of where tonight&rsquo;s races start, track facts and records</small>
            </summary>
            <TrackGuide track={track} races={races} />
          </details>
        )}

        {races.map((r) => (
          <RaceBlock key={r.id} race={r} data={data} tz={meeting.timezone} hasTips={hasTips} />
        ))}

        <p className="ra-source">
          {hasTips ? "Selections by our Harness Analyst. " : ""}Fields, form, silks, prices and results from TAB via the HarnessLink racing service
          {live ? `, updated ${new Date(live.at).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}` : ""}. Fixed odds change until the race
          starts. Gamble responsibly.
        </p>
      </section>
    </DrawnSilks.Provider>
  );
}

function BestTip({ label, race, entry, comment }: { label: string; race: Race; entry: Entry; comment: string | null }) {
  return (
    <a className="ra-besttip" href={`#race-${race.no}`}>
      <Silk path={entry.silk} colours={entry.colours} alt={`${entry.horse} silks`} size={52} />
      <span className="ra-besttext">
        <span className="ra-bestlabel">
          {label} · Race {race.no}
        </span>
        <span className="ra-besthorse">
          <HorseName e={entry} />
        </span>
        <span className="ra-bestmeta">
          {entry.driver && <>{entry.driver} · </>}
          {money(entry.win)}
          {race.resulted && <Outcome placing={entry.placing} />}
        </span>
        {comment && <span className="ra-bestcomment">{comment}</span>}
      </span>
    </a>
  );
}

// The meeting on one screen: each race's selections (or, without tips, the
// favourite) and the winner. Each row jumps to that race.
function RaceIndex({ races, data, tz, hasTips }: { races: Race[]; data: Data; tz: string; hasTips: boolean }) {
  return (
    <>
      <h3 className="ra-h" id="races-top">{hasTips ? "Every race at a glance" : "Races"}</h3>
      <ol className="ra-index">
        {races.map((r) => {
          const picks = (data.notes[r.id]?.picks || []).map((p) => r.entries.find((e) => e.no === p.no)).filter(Boolean) as Entry[];
          const fav = !hasTips ? [...r.entries].filter((e) => !e.scratched && e.win).sort((a, b) => (a.win || 99) - (b.win || 99))[0] : null;
          const winner = r.entries.find((e) => e.placing === "1");
          return (
            <li key={r.id}>
              <a href={`#race-${r.no}`}>
                <span className="ra-index-race">
                  <strong>Race {r.no}</strong>
                  <span>{raceTime(r, tz)}</span>
                </span>
                <span className="ra-index-picks">
                  {(hasTips ? picks : fav ? [fav] : []).map((e, i) => (
                    <span key={e.no} className="ra-index-pick">
                      <Silk path={e.silk} colours={e.colours} alt="" size={22} />
                      <span>
                        {hasTips ? <span className="ra-index-rank">{i + 1}.</span> : <span className="ra-index-rank">Fav</span>} {e.horse}
                        {r.resulted && Number(e.placing) <= 3 && Number(e.placing) > 0 && <Outcome placing={e.placing} />}
                      </span>
                    </span>
                  ))}
                </span>
                {winner && (
                  <span className="ra-index-winner">
                    <span className="ra-index-label">Winner</span>
                    <Silk path={winner.silk} colours={winner.colours} alt="" size={22} />
                    {winner.horse}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function FormFigures({ form }: { form: string | null }) {
  if (!form) return <span className="ra-muted">–</span>;
  return (
    <span className="ra-form" aria-label={`Recent form ${form}`}>
      {form
        .slice(-6)
        .split("")
        .map((f, i) => (
          <span key={i} className={f === "1" ? "is-win" : f === "2" || f === "3" ? "is-place" : /[a-z]/i.test(f) ? "is-x" : ""}>
            {f}
          </span>
        ))}
    </span>
  );
}

function RaceBlock({ race, data, tz, hasTips }: { race: Race; data: Data; tz: string; hasTips: boolean }) {
  const notes = data.notes[race.id] || { picks: [] };
  const byNo = new Map(race.entries.map((e) => [e.no, e]));
  const picks = (notes.picks || []).map((p) => ({ ...p, entry: byNo.get(p.no) })).filter((p) => p.entry);
  const meta = [raceTime(race, tz), race.distance && `${race.distance}m`, startLabel(race), race.gait === "trot" ? "trot" : "pace", race.className, race.stakes && `$${race.stakes.toLocaleString("en-NZ")}`].filter(Boolean);
  const placed = race.resulted ? [...race.entries].filter((e) => Number(e.placing) > 0).sort((a, b) => Number(a.placing) - Number(b.placing)).slice(0, 4) : [];
  const [showForm, setShowForm] = useState(false);
  const prev = race.no > 1 ? race.no - 1 : null;
  const next = race.no < data.meeting.races.length ? race.no + 1 : null;

  return (
    <article className="ra-race" id={`race-${race.no}`}>
      <h3 className="ra-racetitle">
        <span>Race {race.no}</span> {raceTitle(race.name)}
      </h3>
      <p className="ra-racemeta">{meta.join(" · ")}</p>

      {picks.length > 0 && (
        <ol className="ra-picks">
          {picks.map((p, i) => {
            const e = p.entry as Entry;
            return (
              <li key={p.no} className={e.scratched ? "is-scratched" : ""}>
                <Silk path={e.silk} colours={e.colours} alt={`${e.horse} silks`} size={44} />
                <div>
                  <p className="ra-pickname">
                    <span className="ra-pickrank">{i + 1}.</span> <HorseName e={e} />
                    <span className="ra-pickprice">{money(e.win)}</span>
                    {e.scratched && <span className="ra-scr">Scratched</span>}
                    {race.resulted && <Outcome placing={e.placing} />}
                  </p>
                  {p.comment && <p className="ra-pickcomment">{p.comment}</p>}
                  <p className="ra-pickmeta">{[e.driver && `Driver ${e.driver}`, e.trainer && `trainer ${e.trainer}`].filter(Boolean).join(", ")}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {notes.note && <p className="ra-racenote">{notes.note}</p>}

      {placed.length > 0 && (
        <p className="ra-result">
          <strong>Result:</strong>{" "}
          {placed.map((e, i) => (
            <span key={e.no} className="ra-resultitem">
              {i > 0 && " "}
              {ordinal(e.placing)} <Silk path={e.silk} colours={e.colours} alt="" size={18} /> {e.horse}
              {e.placing === "1" && e.toteWin ? ` (${money(e.toteWin)})` : ""}
              {i < placed.length - 1 ? "," : "."}
            </span>
          ))}
        </p>
      )}

      <details className="ra-fold" open={!!notes.map}>
        <summary>
          <span>{notes.map ? "Speed map" : "Speed map: build your own"}</span>
          <small>Drag the runners to where you expect them to settle</small>
        </summary>
        <SpeedMap race={race} layout={notes.map} analystMap={!!notes.map} storageKey={`hl-speedmap:${data.meeting.id}:${race.id}`} />
      </details>

      <details className="ra-fold" open={!hasTips}>
        <summary>
          <span>Full field &amp; form</span>
          <small>{race.entries.filter((e) => !e.scratched).length} starters, with drivers, trainers, recent form and prices</small>
        </summary>
        <div className="ra-fieldbar">
          <button type="button" onClick={() => setShowForm((v) => !v)} aria-pressed={showForm}>
            {showForm ? "Hide form comments" : "Show form comments"}
          </button>
        </div>
        <div className="ra-tablewrap">
          <table className="ra-field">
            <thead>
              <tr>
                <th>Horse</th>
                <th className="ra-hide-sm">Driver / trainer</th>
                <th>Form</th>
                <th className="ra-num">Win</th>
                <th className="ra-num ra-hide-sm">Place</th>
                {race.resulted && <th className="ra-num">Finish</th>}
              </tr>
            </thead>
            <tbody>
              {race.entries.map((e) => (
                <FieldRow key={e.no} e={e} pickRank={picks.findIndex((p) => p.no === e.no)} resulted={race.resulted} showForm={showForm} />
              ))}
            </tbody>
          </table>
        </div>
        {race.dividends && <p className="ra-divs">{race.dividends}</p>}
      </details>

      <nav className="ra-racenav" aria-label={`Around race ${race.no}`}>
        {prev ? <a href={`#race-${prev}`}>← Race {prev}</a> : <span />}
        <a href="#races-top">All races</a>
        {next ? <a href={`#race-${next}`}>Race {next} →</a> : <span />}
      </nav>
    </article>
  );
}

function FieldRow({ e, pickRank, resulted, showForm }: { e: Entry; pickRank: number; resulted: boolean; showForm: boolean }) {
  const start = [e.barrier && `Fr${e.barrier}`, e.handicap ? `${e.handicap}m` : null].filter(Boolean).join(" · ");
  return (
    <>
      <tr className={`${e.scratched ? "is-scratched " : ""}${pickRank >= 0 ? "is-pick" : ""}`}>
        <td>
          <span className="ra-fieldhorse">
            <Silk path={e.silk} colours={e.colours} alt="" size={26} />
            <span>
              <HorseName e={e} />
              {pickRank >= 0 && <span className="ra-tip">Tip {pickRank + 1}</span>}
              {e.scratched && <span className="ra-scr">Scratched</span>}
              {e.emergency && <span className="ra-scr">Emergency</span>}
              <span className="ra-sub">
                {start && <>{start} · </>}
                <span className="ra-show-sm">{e.driver}</span>
                {e.gearOn && <> · Gear on: {e.gearOn}</>}
              </span>
            </span>
          </span>
        </td>
        <td className="ra-hide-sm">
          {e.driver || "–"}
          {e.junior && <span className="ra-muted"> (j)</span>}
          <span className="ra-sub">{e.trainer}</span>
        </td>
        <td>
          <FormFigures form={e.form} />
        </td>
        <td className="ra-num">{e.scratched ? "–" : money(e.win)}</td>
        <td className="ra-num ra-hide-sm">{e.scratched ? "–" : money(e.place)}</td>
        {resulted && <td className="ra-num">{e.placing ? ordinal(e.placing) : "–"}</td>}
      </tr>
      {showForm && e.comment && (
        <tr className="ra-commentrow">
          <td colSpan={resulted ? 6 : 5}>{e.comment}</td>
        </tr>
      )}
    </>
  );
}
