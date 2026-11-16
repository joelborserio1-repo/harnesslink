"use client";

import type { Race } from "@/lib/analysis";

// Track guide on a form guide: the oval drawn to scale from the track's
// circumference and straight, with today's start positions, quarter poles and
// the finish; the track facts; weather at the track; and track records.
// Track data is edited in the newsroom under Tracks (cms api::track.track).

export type Track = {
  name: string;
  region?: string | null;
  country?: string | null;
  circumference?: number | null;
  straight?: number | null;
  direction?: "anticlockwise" | "clockwise" | null;
  sprintLane?: boolean | null;
  fieldLimitMobile?: number | null;
  frontLineMobile?: number | null;
  starts?: { distance: number; mobile?: boolean | null; standing?: boolean | null }[];
  records?: { gait: "pace" | "trot"; distance: number; start?: "mobile" | "standing" | null; mileRate?: string | null; horse?: string | null; date?: string | null }[];
};
export type Weather = {
  temp: number | null;
  feels: number | null;
  code: number | null;
  rain: number | null;
  wind: number | null;
  gusts: number | null;
  windFrom: number | null;
  max: number | null;
  min: number | null;
  rainChance: number | null;
  rainToday: number | null;
} | null;

const START_COLOURS = ["#1f5fd1", "#d0491c", "#2e9a48", "#6b2fa0", "#b58a1a"];
const W = 760;
const H = 420;

function sky(code: number | null) {
  if (code == null) return "";
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Thunderstorms";
}
const compass = (deg: number | null) => (deg == null ? "" : ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16]);

// Geometry, in metres along the running line from the start of the home straight.
function geometry(track: Track) {
  const C = track.circumference || 1000;
  const S = Math.min(track.straight || C * 0.22, C * 0.45);
  const R = (C - 2 * S) / (2 * Math.PI);
  const k = Math.min((W - 150) / (S + 2 * R), (H - 210) / (2 * R));
  const cx = W / 2;
  const cy = H / 2;
  const flip = track.direction === "clockwise" ? -1 : 1;
  const at = (s: number) => {
    const m = ((s % C) + C) % C;
    let x: number;
    let y: number;
    let nx: number;
    let ny: number;
    if (m < S) {
      x = -S / 2 + m;
      y = R;
      nx = 0;
      ny = 1;
    } else if (m < S + Math.PI * R) {
      const t = (m - S) / R;
      x = S / 2 + R * Math.sin(t);
      y = R * Math.cos(t);
      nx = Math.sin(t);
      ny = Math.cos(t);
    } else if (m < 2 * S + Math.PI * R) {
      x = S / 2 - (m - S - Math.PI * R);
      y = -R;
      nx = 0;
      ny = -1;
    } else {
      const t = (m - 2 * S - Math.PI * R) / R;
      x = -S / 2 - R * Math.sin(t);
      y = -R * Math.cos(t);
      nx = -Math.sin(t);
      ny = -Math.cos(t);
    }
    return { x: cx + flip * x * k, y: cy + y * k, nx: flip * nx, ny, along: m < S ? 1 : m >= S + Math.PI * R && m < 2 * S + Math.PI * R ? -1 : 0 };
  };
  // The winning post: most of the way down the home straight (approximate).
  const finish = S * 0.8;
  return { C, S, R, k, cx, cy, at, finish, flip };
}

function ovalPath(cx: number, cy: number, S: number, R: number, k: number) {
  const x1 = cx - (S / 2) * k;
  const x2 = cx + (S / 2) * k;
  const r = R * k;
  return `M ${x1} ${cy + r} L ${x2} ${cy + r} A ${r} ${r} 0 0 0 ${x2} ${cy - r} L ${x1} ${cy - r} A ${r} ${r} 0 0 0 ${x1} ${cy + r} Z`;
}

export default function TrackGuide({ track, races, weather }: { track: Track; races: Race[]; weather: Weather }) {
  const g = geometry(track);
  const r = g.R * g.k;
  const band = Math.max(18, Math.min(30, r * 0.28));

  // Distances raced today (from the field), plus any the track lists, labelled with their start types.
  const today = new Map<number, Set<string>>();
  for (const race of races) {
    if (!race.distance) continue;
    const set = today.get(race.distance) || new Set<string>();
    if (race.start) set.add(race.start === "mobile" ? "Mobile" : "Standing");
    today.set(race.distance, set);
  }
  const starts = [...today.entries()].sort((a, b) => a[0] - b[0]).slice(0, 5);

  const finish = g.at(g.finish);
  const pole = (d: number) => g.at(g.finish - d);
  const outer = (p: { x: number; y: number; nx: number; ny: number }, dist: number) => ({ x: p.x + p.nx * dist, y: p.y + p.ny * dist });

  const pace = (track.records || []).filter((x) => x.gait === "pace");
  const trot = (track.records || []).filter((x) => x.gait === "trot");

  return (
    <section className="tg" aria-label={`${track.name} track guide`}>
      <div className="tg-head">
        <p className="ra-kicker">Track guide{track.region ? ` · ${track.region}` : ""}</p>
        <h3>{track.name}</h3>
      </div>
      <div className="tg-map">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${track.name}: start positions for ${starts.map(([d]) => `${d}m`).join(", ")}`}>
          <path d={ovalPath(g.cx, g.cy, g.S, g.R, g.k)} fill="none" stroke="#d8c39a" strokeWidth={band * 2} strokeLinejoin="round" />
          <path d={ovalPath(g.cx, g.cy, g.S, g.R, g.k)} fill="none" stroke="#e9dcc0" strokeWidth={1} strokeDasharray="4 6" />
          <path d={ovalPath(g.cx, g.cy, g.S, g.R - band / g.k, g.k)} fill="#b9cf9c" />
          <text x={g.cx} y={g.cy + 6} textAnchor="middle" className="tg-infield">
            {track.name.split(" ")[0].toUpperCase()}
          </text>
          <text x={g.cx} y={g.cy - g.R * g.k + band + 16} textAnchor="middle" className="tg-label">
            BACK STRAIGHT
          </text>

          {/* Quarter poles: distance to the finish. */}
          {[400, 800, 1200].filter((d) => d < g.C).map((d) => {
            const p = pole(d);
            const o = outer(p, band + 4);
            const t = outer(p, band + 18);
            return (
              <g key={d}>
                <line x1={o.x} y1={o.y} x2={outer(p, band + 10).x} y2={outer(p, band + 10).y} stroke="#b3202a" strokeWidth={4} />
                <text x={t.x} y={t.y + 4} textAnchor="middle" className="tg-pole">
                  {d}
                </text>
              </g>
            );
          })}

          {/* Finish and grandstand. */}
          {(() => {
            const a = outer(finish, -band);
            const b = outer(finish, band);
            const lbl = outer(finish, band + 30);
            return (
              <g>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111" strokeWidth={5} strokeDasharray="4 4" />
                <rect x={lbl.x - 34} y={lbl.y - 13} width={68} height={22} fill="#111" />
                <text x={lbl.x} y={lbl.y + 3} textAnchor="middle" className="tg-finish">
                  FINISH
                </text>
              </g>
            );
          })()}

          {/* Today's start points. */}
          {starts.map(([d, kinds], i) => {
            const p = g.at(g.finish - (d % g.C));
            const colour = START_COLOURS[i % START_COLOURS.length];
            const a = outer(p, -band);
            const b = outer(p, band);
            const side = p.ny >= 0 ? 1 : -1;
            const lx = Math.min(W - 62, Math.max(62, p.x + p.nx * (band + 46)));
            const ly = Math.min(H - 20, Math.max(20, p.y + p.ny * (band + 46) + (p.along === 0 ? 0 : side * (i % 2 ? 38 : 0))));
            const ax = p.along * g.flip;
            return (
              <g key={d}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colour} strokeWidth={5} />
                {p.along !== 0 && (
                  <path d={`M ${p.x + ax * 10} ${p.y - side * (band + 8)} l ${ax * 22} 0 m ${-ax * 6} -5 l ${ax * 6} 5 l ${-ax * 6} 5`} stroke={colour} strokeWidth={2} fill="none" />
                )}
                <line x1={b.x} y1={b.y} x2={lx} y2={ly} stroke={colour} strokeWidth={1.5} />
                <rect x={lx - 58} y={ly - 17} width={116} height={34} fill={colour} />
                <text x={lx} y={ly - 1} textAnchor="middle" className="tg-start">
                  {d}m START
                </text>
                <text x={lx} y={ly + 12} textAnchor="middle" className="tg-startsub">
                  {[...kinds].join(" · ") || "Start"}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="tg-note">
          Drawn to scale from the track&rsquo;s circumference and straight; the finishing post is approximate. Coloured marks are where today&rsquo;s races start.
        </p>
      </div>

      <div className="tg-cols">
        <div>
          <h4>Track information</h4>
          <table className="tg-table">
            <tbody>
              {track.circumference ? <Row k="Circumference" v={`${track.circumference}m`} /> : null}
              {track.straight ? <Row k="Home straight" v={`${track.straight}m`} /> : null}
              {track.sprintLane != null ? <Row k="Sprint lane" v={track.sprintLane ? "Yes" : "No"} /> : null}
              {track.direction ? <Row k="Direction" v={track.direction === "clockwise" ? "Clockwise" : "Anti-clockwise"} /> : null}
              {track.fieldLimitMobile ? <Row k="Field limit (mobile)" v={String(track.fieldLimitMobile)} /> : null}
              {track.frontLineMobile ? <Row k="Front line (mobile)" v={String(track.frontLineMobile)} /> : null}
            </tbody>
          </table>
        </div>
        {weather && (
          <div>
            <h4>Weather at the track</h4>
            <div className="tg-weather">
              <p className="tg-now">
                <strong>{weather.temp != null ? `${Math.round(weather.temp)}°` : "–"}</strong>
                <span>
                  {sky(weather.code)}
                  {weather.feels != null && <small>Feels like {Math.round(weather.feels)}°</small>}
                </span>
              </p>
              <dl>
                <div>
                  <dt>Today</dt>
                  <dd>
                    {weather.max != null ? `${Math.round(weather.max)}° / ${Math.round(weather.min ?? 0)}°` : "–"}
                    {weather.rainChance != null && <small>{weather.rainChance}% chance of rain</small>}
                  </dd>
                </div>
                <div>
                  <dt>Rain</dt>
                  <dd>
                    {weather.rainToday ? `${weather.rainToday} mm` : "None"}
                    <small>today so far / forecast</small>
                  </dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>
                    {weather.wind != null ? `${compass(weather.windFrom)} ${Math.round(weather.wind)} km/h` : "–"}
                    {weather.gusts != null && <small>Gusts {Math.round(weather.gusts)} km/h</small>}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      {(pace.length > 0 || trot.length > 0) && (
        <div className="tg-cols">
          {[
            ["Pacers track records", pace],
            ["Trotters track records", trot],
          ].map(([title, rows]) =>
            (rows as Track["records"])!.length ? (
              <div key={title as string}>
                <h4>{title as string}</h4>
                <table className="tg-table tg-records">
                  <thead>
                    <tr>
                      <th>Distance</th>
                      <th>Mile rate</th>
                      <th>Horse</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rows as NonNullable<Track["records"]>).map((x, i) => (
                      <tr key={i}>
                        <td>
                          {x.distance}m {x.start === "standing" ? "SS" : "MS"}
                        </td>
                        <td>
                          <strong>{x.mileRate || "–"}</strong>
                        </td>
                        <td>{x.horse || "–"}</td>
                        <td>{x.date ? new Date(`${x.date}T12:00:00Z`).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null
          )}
        </div>
      )}
      <p className="tg-note">MS = mobile start · SS = standing start.{weather ? " Weather from Open-Meteo for the track’s location." : ""}</p>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th scope="row">{k}</th>
      <td>{v}</td>
    </tr>
  );
}
