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
import SpeedMap, { Cloth, DrawnSilks, Silk } from "./SpeedMap";
import TrackGuide, { type Track } from "./TrackGuide";
import RaceWeather from "./RaceWeather";

// The analysis sheet under a Harness Analyst story: best bet and best value,
// then every race with the analyst's selections, a speed map, and the full
// field (silks, form, TAB fixed odds). Prices, scratchings and results are
// refreshed from the CMS when the page opens and every two minutes after.
// All of it is in the server-rendered HTML, so search engines read it too.

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
  const shortDate = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${meeting.date}T12:00:00Z`));

  return (
    <DrawnSilks.Provider value={drawn}>
    <section className="ra" aria-label={`${meeting.venue} race analysis`}>
      <header className="ra-head">
        <div>
          <p className="ra-kicker">{hasTips ? "Harness Analyst" : "Harnesslink form guide"}</p>
          <h2 className="ra-venue">
            {meeting.venue} {hasTips ? "selections" : "form guide"}
          </h2>
          <p className="ra-date">{longDate(meeting.date)}</p>
        </div>
        <dl className="ra-facts">
          <div>
            <dt>Races</dt>
            <dd>{races.length}</dd>
          </div>
          {first && (
            <div>
              <dt>First race</dt>
              <dd>{raceTime(first, meeting.timezone)}</dd>
            </div>
          )}
          {condition && (
            <div>
              <dt>Track</dt>
              <dd>{condition}</dd>
            </div>
          )}
          {tally.tipped > 0 && resulted.length > 0 && (
            <div>
              <dt>Top tips</dt>
              <dd>
                {tally.won} won · {tally.placed} placed
              </dd>
            </div>
          )}
        </dl>
      </header>

      <RaceWeather weather={live?.weather ?? null} firstRace={first ? raceTime(first, meeting.timezone) : null} condition={condition} />

      {(best || value) && (
        <div className="ra-bestwrap">
          <h3 className="ra-sectiontitle">Harness analyst best tips</h3>
          <div className="ra-best">
            {best && <BestCard label="Best bet" {...best} />}
            {value && <BestCard label="Best value" {...value} />}
          </div>
        </div>
      )}

      {hasTips && <Tipsheet races={races} data={data} tz={meeting.timezone} title={`${meeting.venue} selections ${shortDate}`} />}

      {track && (
        <details className="ra-trackwrap" open>
          <summary>Track guide: {track.name}</summary>
          <TrackGuide track={track} races={races} />
        </details>
      )}

      <nav className="ra-nav" aria-label="Races">
        {races.map((r) => (
          <a key={r.id} href={`#race-${r.no}`}>
            <strong>R{r.no}</strong>
            <span>{raceTime(r, meeting.timezone)}</span>
          </a>
        ))}
      </nav>

      {races.map((r) => (
        <RaceBlock key={r.id} race={r} data={data} tz={meeting.timezone} hasTips={hasTips} />
      ))}

      <p className="ra-source">
        {hasTips ? "Selections by our Harness Analyst. " : ""}Fields, form, silks, prices and results from TAB via the HarnessLink racing service
        {live ? `, updated ${new Date(live.at).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}` : ""}. Fixed odds are TAB&rsquo;s and change
        until the race starts. Gamble responsibly.
      </p>
    </section>
    </DrawnSilks.Provider>
  );
}

// Every race's selections on one screen, like the tipsheet of old, with how they went.
function Tipsheet({ races, data, tz, title }: { races: Race[]; data: Data; tz: string; title: string }) {
  return (
    <div className="ra-sheet">
      <h3 className="ra-sectiontitle">{title}</h3>
      <div className="ra-tablewrap">
        <table className="ra-sheettable">
          <thead>
            <tr>
              <th>Race</th>
              <th>1st selection</th>
              <th className="ra-hide-sm">2nd</th>
              <th className="ra-hide-sm">3rd</th>
              <th className="ra-num">Winner</th>
            </tr>
          </thead>
          <tbody>
            {races.map((r) => {
              const picks = (data.notes[r.id]?.picks || []).map((p) => r.entries.find((e) => e.no === p.no)).filter(Boolean) as Entry[];
              const winner = r.entries.find((e) => e.placing === "1");
              const isBest = data.bestBet?.race === r.no;
              const isValue = data.bestValue?.race === r.no;
              return (
                <tr key={r.id}>
                  <td>
                    <a href={`#race-${r.no}`} className="ra-sheetrace">
                      <strong>R{r.no}</strong> <span>{raceTime(r, tz)}</span>
                    </a>
                  </td>
                  {[0, 1, 2].map((i) => {
                    const e = picks[i];
                    const tag = e && ((isBest && data.bestBet?.no === e.no && "Best bet") || (isValue && data.bestValue?.no === e.no && "Best value"));
                    return (
                      <td key={i} className={i ? "ra-hide-sm" : ""}>
                        {e ? (
                          <span className="ra-sheetpick">
                            <Cloth no={e.no} />
                            <span>
                              <strong>{e.horse}</strong>
                              <small>
                                {money(e.win)}
                                {tag && <b> · {tag}</b>}
                                {r.resulted && Number(e.placing) > 0 && Number(e.placing) <= 3 ? <b className={e.placing === "1" ? "is-won" : "is-placed"}> · {e.placing === "1" ? "Won" : ordinal(e.placing)}</b> : null}
                              </small>
                            </span>
                          </span>
                        ) : (
                          <span className="ra-muted">–</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="ra-num">
                    {winner ? (
                      <span className="ra-sheetwin">
                        <Cloth no={winner.no} /> {winner.horse}
                      </span>
                    ) : (
                      <span className="ra-muted">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BestCard({ label, race, entry, comment }: { label: string; race: Race; entry: Entry; comment: string | null }) {
  return (
    <a className="ra-bestcard" href={`#race-${race.no}`}>
      <span className="ra-bestlabel">{label}</span>
      <span className="ra-bestbody">
        <Silk path={entry.silk} colours={entry.colours} alt={`${entry.horse} silks`} size={46} />
        <span>
          <span className="ra-bestrace">Race {race.no}</span>
          <span className="ra-besthorse">
            <Cloth no={entry.no} /> {entry.horse}
          </span>
          <span className="ra-bestmeta">
            {entry.driver && <>{entry.driver} · </>}
            {money(entry.win)}
            {race.resulted && entry.placing && <Outcome placing={entry.placing} />}
          </span>
        </span>
      </span>
      {comment && <span className="ra-bestcomment">{comment}</span>}
    </a>
  );
}

function Outcome({ placing }: { placing: string | null }) {
  const n = Number(placing);
  if (!n) return null;
  return <span className={`ra-outcome${n === 1 ? " is-won" : n <= 3 ? " is-placed" : ""}`}>{n === 1 ? "Won" : ordinal(n)}</span>;
}

function FormFigures({ form }: { form: string | null }) {
  if (!form) return <span className="ra-muted">–</span>;
  const figs = form.slice(-6).split("");
  return (
    <span className="ra-form" aria-label={`Recent form ${form}`}>
      {figs.map((f, i) => (
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
  const meta = [race.distance && `${race.distance}m`, startLabel(race), race.gait === "trot" ? "Trot" : "Pace", race.className, race.stakes && `$${race.stakes.toLocaleString("en-NZ")}`].filter(Boolean);
  const placed = race.resulted ? [...race.entries].filter((e) => Number(e.placing) > 0).sort((a, b) => Number(a.placing) - Number(b.placing)).slice(0, 4) : [];
  const [showForm, setShowForm] = useState(false);

  return (
    <article className="ra-race" id={`race-${race.no}`}>
      <header className="ra-racehead">
        <div className="ra-raceno">
          <span>Race</span>
          <strong>{race.no}</strong>
        </div>
        <div>
          <h3>{raceTitle(race.name)}</h3>
          <p>
            {raceTime(race, tz) && <strong>{raceTime(race, tz)}</strong>}
            {meta.map((m) => (
              <span key={String(m)}> · {m}</span>
            ))}
          </p>
        </div>
      </header>

      {placed.length > 0 && (
        <div className="ra-result">
          <span className="ra-resultlabel">Result</span>
          <ol>
            {placed.map((e) => (
              <li key={e.no}>
                <span className="ra-muted">{ordinal(e.placing)}</span> <Cloth no={e.no} /> <strong>{e.horse}</strong>
                {e.placing === "1" && e.toteWin ? <span className="ra-muted"> {money(e.toteWin)}</span> : null}
              </li>
            ))}
          </ol>
          {race.dividends && <p className="ra-divs">{race.dividends}</p>}
        </div>
      )}

      {picks.length > 0 && (
        <div className="ra-picks">
          <h4>Our selections</h4>
          <ol>
            {picks.map((p, i) => {
              const e = p.entry as Entry;
              return (
                <li key={p.no} className={e.scratched ? "is-scratched" : ""}>
                  <span className="ra-pickrank">{i + 1}</span>
                  <Silk path={e.silk} colours={e.colours} alt={`${e.horse} silks`} size={38} />
                  <div className="ra-pickbody">
                    <p className="ra-pickname">
                      <Cloth no={e.no} /> <strong>{e.horse}</strong>
                      {e.scratched && <span className="ra-scr">Scratched</span>}
                      {race.resulted && <Outcome placing={e.placing} />}
                    </p>
                    <p className="ra-pickmeta">
                      {[e.driver && `Driver ${e.driver}`, e.trainer && `Trainer ${e.trainer}`].filter(Boolean).join(" · ")}
                    </p>
                    {p.comment && <p className="ra-pickcomment">{p.comment}</p>}
                  </div>
                  <div className="ra-pickprice">
                    <span>{money(e.win)}</span>
                    <small>Win</small>
                  </div>
                </li>
              );
            })}
          </ol>
          {notes.note && <p className="ra-racenote">{notes.note}</p>}
        </div>
      )}

      <details className="ra-mapwrap" open={!!notes.map}>
        <summary>{notes.map ? "Speed map" : "Speed map: build your own"}</summary>
        <SpeedMap race={race} layout={notes.map} analystMap={!!notes.map} storageKey={`hl-speedmap:${data.meeting.id}:${race.id}`} />
      </details>

      <details className="ra-fieldwrap" open={!hasTips}>
        <summary>Full field &amp; form{race.entries.length ? ` (${race.entries.filter((e) => !e.scratched).length} starters)` : ""}</summary>
      <div className="ra-fieldhead">
        <h4>Field</h4>
        <button type="button" onClick={() => setShowForm((v) => !v)} aria-pressed={showForm}>
          {showForm ? "Hide form comments" : "Show form comments"}
        </button>
      </div>
      <div className="ra-tablewrap">
        <table className="ra-field">
          <thead>
            <tr>
              <th>No.</th>
              <th className="ra-silkcol" aria-label="Silks" />
              <th>Horse</th>
              <th className="ra-hide-sm">Driver / Trainer</th>
              <th>Form</th>
              <th className="ra-num">Win</th>
              <th className="ra-num ra-hide-sm">Place</th>
              {race.resulted && <th className="ra-num">Finish</th>}
            </tr>
          </thead>
          <tbody>
            {race.entries.map((e) => {
              const pickRank = picks.findIndex((p) => p.no === e.no);
              return (
                <FieldRow key={e.no} e={e} pickRank={pickRank} resulted={race.resulted} showForm={showForm} />
              );
            })}
          </tbody>
        </table>
      </div>
      </details>
    </article>
  );
}

function FieldRow({ e, pickRank, resulted, showForm }: { e: Entry; pickRank: number; resulted: boolean; showForm: boolean }) {
  const start = [e.barrier && `Fr${e.barrier}`, e.handicap ? `${e.handicap}m` : null].filter(Boolean).join(" · ");
  return (
    <>
      <tr className={`${e.scratched ? "is-scratched " : ""}${pickRank >= 0 ? "is-pick" : ""}`}>
        <td>
          <Cloth no={e.no} />
        </td>
        <td className="ra-silkcol">
          <Silk path={e.silk} colours={e.colours} alt="" size={28} />
        </td>
        <td>
          <span className="ra-horse">{e.horse}</span>
          {pickRank >= 0 && <span className="ra-tip">Tip {pickRank + 1}</span>}
          {e.scratched && <span className="ra-scr">Scratched</span>}
          {e.emergency && <span className="ra-scr">Emergency</span>}
          <span className="ra-sub">
            {start && <>{start} · </>}
            <span className="ra-show-sm">{e.driver}</span>
            {e.gearOn && <> · Gear on: {e.gearOn}</>}
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
          <td />
          <td colSpan={resulted ? 7 : 6}>{e.comment}</td>
        </tr>
      )}
    </>
  );
}
