"use client";

import { useState } from "react";
import type { Race } from "@/lib/analysis";

// Track guide on a form guide: the oval built to scale from the track's
// circumference and straight, in a 3D (isometric) or flat view, with where
// tonight's distances start, the quarter poles, the finish and the grandstand;
// then the track's facts and records. Track data is edited in the newsroom
// under Tracks (cms api::track.track).

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

const START_COLOURS = ["#1f5fd1", "#d0491c", "#2e9a48", "#6b2fa0", "#b58a1a"];
const W = 820;
const LANE = 26; // drawn width of the racing surface, metres

type Pt = { x: number; y: number };

// Running line in metres: origin at the centre of the oval, home straight
// along the bottom (+y), racing left to right on it (anticlockwise from above).
function course(track: Track) {
  const C = track.circumference || 1000;
  const S = Math.min(track.straight || C * 0.22, C * 0.45);
  const R = (C - 2 * S) / (2 * Math.PI);
  const flip = track.direction === "clockwise" ? -1 : 1;
  // Point s metres along from the start of the home straight, offset `off`
  // metres outward from the running line.
  const at = (s: number, off = 0): Pt & { nx: number; ny: number } => {
    const m = ((s % C) + C) % C;
    let x: number, y: number, nx: number, ny: number;
    if (m < S) [x, y, nx, ny] = [-S / 2 + m, R, 0, 1];
    else if (m < S + Math.PI * R) {
      const t = (m - S) / R;
      [x, y, nx, ny] = [S / 2 + R * Math.sin(t), R * Math.cos(t), Math.sin(t), Math.cos(t)];
    } else if (m < 2 * S + Math.PI * R) [x, y, nx, ny] = [S / 2 - (m - S - Math.PI * R), -R, 0, -1];
    else {
      const t = (m - 2 * S - Math.PI * R) / R;
      [x, y, nx, ny] = [-S / 2 - R * Math.sin(t), -R * Math.cos(t), -Math.sin(t), -Math.cos(t)];
    }
    return { x: flip * (x + nx * off), y: y + ny * off, nx: flip * nx, ny };
  };
  const ring = (off: number, n = 160) => Array.from({ length: n }, (_, i) => at((i / n) * C, off));
  return { C, S, R, at, ring, finish: S * 0.8, flip };
}

function projector(track: Track, iso: boolean) {
  const c = course(track);
  const ang = iso ? (-11 * Math.PI) / 180 : 0;
  const squash = iso ? 0.5 : 1;
  const raw = (p: Pt) => {
    const x = p.x * Math.cos(ang) - p.y * Math.sin(ang);
    const y = p.x * Math.sin(ang) + p.y * Math.cos(ang);
    return { x, y: y * squash };
  };
  // Fit the outer edge (plus the grandstand) to the drawing.
  const pts = [...c.ring(LANE / 2 + 40, 80), ...c.ring(-LANE / 2, 40)].map(raw);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const k = (W - 80) / (maxX - minX);
  const top = iso ? 120 : 90;
  const H = Math.round((maxY - minY) * k + top + (iso ? 40 : 90));
  const P = (p: Pt) => {
    const r = raw(p);
    return { x: 40 + (r.x - minX) * k, y: top + (r.y - minY) * k };
  };
  return { ...c, P, k, H, iso, depth: iso ? 18 : 0 };
}

const poly = (pts: Pt[]) => `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}Z`;

export default function TrackGuide({ track, races }: { track: Track; races: Race[] }) {
  const [iso, setIso] = useState(true);
  const g = projector(track, iso);

  // Distances raced tonight, with their start types.
  const tonight = new Map<number, Set<string>>();
  for (const r of races) {
    if (!r.distance) continue;
    const set = tonight.get(r.distance) || new Set<string>();
    if (r.start) set.add(r.start === "mobile" ? "Mobile" : "Standing");
    tonight.set(r.distance, set);
  }
  const starts = [...tonight.entries()].sort((a, b) => a[0] - b[0]).slice(0, 5);

  const outer = g.ring(LANE / 2).map(g.P);
  const inner = g.ring(-LANE / 2).map(g.P);
  const rail = g.ring(-LANE / 2 + 1.5).map(g.P);
  const side = outer.map((p) => ({ x: p.x, y: p.y + g.depth }));

  // Label positions: in 3D, callouts stand above the point on a stem; flat, they sit outside the track.
  const callout = (s: number, lift: number) => {
    const base = g.at(s);
    const p = g.P(base);
    if (g.iso) return { p, l: { x: p.x, y: p.y - lift } };
    const o = g.P(g.at(s, LANE / 2 + 30));
    return { p, l: { x: Math.min(W - 70, Math.max(70, o.x)), y: o.y } };
  };

  // Grandstand: outside the home straight, level with the finish.
  const gsA = g.at(g.finish - 70, LANE / 2 + 16);
  const gsB = g.at(g.finish + 30, LANE / 2 + 16);
  const gsC = g.at(g.finish + 30, LANE / 2 + 34);
  const gsD = g.at(g.finish - 70, LANE / 2 + 34);
  const stand = [gsA, gsB, gsC, gsD].map(g.P);
  const standH = g.iso ? 16 : 0;

  const pace = (track.records || []).filter((x) => x.gait === "pace");
  const trot = (track.records || []).filter((x) => x.gait === "trot");

  return (
    <section className="tg" aria-label={`${track.name} track guide`}>
      <div className="tg-head">
        <div>
          <p className="tg-kicker">Harnesslink track guide{track.region ? ` · ${track.region}` : ""}</p>
          <h3>{track.name}</h3>
          <p className="tg-sub">Where tonight&rsquo;s races start</p>
        </div>
        <div className="tg-views" role="group" aria-label="View">
          <button type="button" aria-pressed={iso} onClick={() => setIso(true)}>
            3D view
          </button>
          <button type="button" aria-pressed={!iso} onClick={() => setIso(false)}>
            Flat view
          </button>
        </div>
      </div>

      <div className="tg-map">
        <svg viewBox={`0 0 ${W} ${g.H}`} role="img" aria-label={`${track.name}: start positions for ${starts.map(([d]) => `${d}m`).join(", ")}`}>
          <defs>
            <linearGradient id="tg-turf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c7dcaa" />
              <stop offset="1" stopColor="#a9c58a" />
            </linearGradient>
            <linearGradient id="tg-surface" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e6d3ad" />
              <stop offset="1" stopColor="#d5bd8d" />
            </linearGradient>
          </defs>

          {/* Base: the side wall gives the 3D view its depth. */}
          {g.iso && <path d={poly(side)} fill="#b39363" />}
          <path d={`${poly(outer)} ${poly(inner)}`} fillRule="evenodd" fill="url(#tg-surface)" stroke="#bfa477" strokeWidth={1} />
          <path d={poly(inner)} fill="url(#tg-turf)" />
          <path d={poly(rail)} fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.9} />

          {/* Infield name, lying on the grass. */}
          {(() => {
            const c = g.P({ x: 0, y: 0 });
            return (
              <text
                x={c.x}
                y={c.y + 6}
                textAnchor="middle"
                className="tg-infield"
                transform={g.iso ? `rotate(-11 ${c.x} ${c.y}) translate(${c.x} ${c.y}) scale(1 0.55) translate(${-c.x} ${-c.y})` : undefined}
              >
                {track.name.split(" ")[0].toUpperCase()}
              </text>
            );
          })()}

          {/* Grandstand. */}
          <g>
            {g.iso && <path d={poly([stand[0], stand[1], { x: stand[1].x, y: stand[1].y - standH }, { x: stand[0].x, y: stand[0].y - standH }])} fill="#c9ccd2" />}
            <path d={poly(stand.map((p) => ({ x: p.x, y: p.y - standH })))} fill="#e4e6ea" stroke="#a9adb5" />
            {g.iso && <path d={poly([stand[3], stand[2], { x: stand[2].x, y: stand[2].y - standH }, { x: stand[3].x, y: stand[3].y - standH }])} fill="#b7bbc2" />}
            {(() => {
              const m = g.P(g.at(g.finish - 20, LANE / 2 + 26));
              return (
                <text x={m.x} y={m.y - standH / 2 + 3} textAnchor="middle" className="tg-stand">
                  GRANDSTAND
                </text>
              );
            })()}
          </g>

          {/* Quarter poles: distance to the finish. */}
          {[400, 800, 1200]
            .filter((d) => d < g.C)
            .map((d) => {
              const p = g.P(g.at(g.finish - d, LANE / 2 + 3));
              const h = g.iso ? 16 : 10;
              return (
                <g key={d}>
                  <rect x={p.x - 2.5} y={p.y - h} width={5} height={h} fill="#fff" stroke="#b3202a" strokeWidth={1} />
                  <rect x={p.x - 2.5} y={p.y - h} width={5} height={h / 3} fill="#b3202a" />
                  <rect x={p.x - 2.5} y={p.y - h / 3} width={5} height={h / 3} fill="#b3202a" />
                  <text x={p.x + 6} y={p.y - h + 9} className="tg-pole">
                    {d}
                  </text>
                </g>
              );
            })}

          {/* Direction of racing. */}
          {(() => {
            const a = g.P(g.at(g.finish - 160, 0));
            const b = g.P(g.at(g.finish - 110, 0));
            const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            return (
              <g transform={`translate(${a.x} ${a.y}) rotate(${ang})`} opacity={0.75}>
                <path d="M0 0 L34 0 M26 -6 L34 0 L26 6" stroke="#5a4526" strokeWidth={2.2} fill="none" />
              </g>
            );
          })()}

          {/* Finish. */}
          {(() => {
            const a = g.P(g.at(g.finish, -LANE / 2));
            const b = g.P(g.at(g.finish, LANE / 2));
            const { p, l } = callout(g.finish, 74);
            return (
              <g>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111" strokeWidth={4} strokeDasharray="3 3" />
                <line x1={p.x} y1={p.y} x2={l.x} y2={l.y} stroke="#111" strokeWidth={1.5} />
                <rect x={l.x - 36} y={l.y - 22} width={72} height={24} fill="#111" />
                <text x={l.x} y={l.y - 6} textAnchor="middle" className="tg-finish">
                  FINISH
                </text>
              </g>
            );
          })()}

          {/* Tonight's starts. */}
          {starts.map(([d, kinds], i) => {
            const s = g.finish - (d % g.C);
            const colour = START_COLOURS[i % START_COLOURS.length];
            const a = g.P(g.at(s, -LANE / 2));
            const b = g.P(g.at(s, LANE / 2));
            const { p, l } = callout(s, 92 + (i % 2) * 34);
            return (
              <g key={d}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colour} strokeWidth={4.5} />
                <line x1={p.x} y1={p.y} x2={l.x} y2={l.y} stroke={colour} strokeWidth={1.6} />
                <circle cx={p.x} cy={p.y} r={3} fill={colour} />
                <rect x={l.x - 62} y={l.y - 34} width={124} height={36} fill={colour} />
                <text x={l.x} y={l.y - 16} textAnchor="middle" className="tg-start">
                  {d}m START
                </text>
                <text x={l.x} y={l.y - 4} textAnchor="middle" className="tg-startsub">
                  {[...kinds].join(" · ") || "Start"}
                  {d > g.C ? ` · ${Math.floor(d / g.C)} lap${d >= 2 * g.C ? "s" : ""} + ${d % g.C}m` : ""}
                </text>
              </g>
            );
          })}
        </svg>
        <ul className="tg-legend">
          {starts.map(([d], i) => (
            <li key={d}>
              <span style={{ background: START_COLOURS[i % START_COLOURS.length] }} /> {d}m start
            </li>
          ))}
          <li>
            <span className="tg-legend-pole" /> Quarter poles (metres to the finish)
          </li>
          <li>
            <span className="tg-legend-finish" /> Finish
          </li>
        </ul>
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
        {[
          ["Pacers track records", pace],
          ["Trotters track records", trot],
        ].map(([title, rows]) =>
          (rows as NonNullable<Track["records"]>).length ? (
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
      <p className="tg-note">
        MS = mobile start · SS = standing start. Oval drawn to scale from the track&rsquo;s circumference and straight{iso ? " (3D view not to scale)" : ""}; the finishing
        post and grandstand are placed approximately.
      </p>
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
