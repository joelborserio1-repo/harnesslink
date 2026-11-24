import { Silk } from "@/components/analysis/SpeedMap";
import type { MapLane, MapRunner, RaceMapData } from "@/lib/api";
import { coatDefs, coatFor, posName, rigSvg } from "@/lib/race-map-art";
import { silkUrl } from "@/lib/analysis";
import { parseSilk, silkDataUrl } from "@/lib/silks";

// A HarnessLink race map under a story, exactly as the race maps on the live
// site (Len Smith Mile, Christian Cullen): blue header, the expected map (a
// track with each horse in its settling position, leader on the right),
// runner by runner, an optional alternative map, the field at a glance.
// Edited in Strapi under the story's Race map; filled from TAB. Styles in
// globals.css under "Race map".

type Placed = { r: MapRunner; lane: "rail" | "outside"; pos: number };

const paras = (s: string | null) =>
  (s || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function placements(runners: MapRunner[], alt: boolean): Placed[] {
  const out: Placed[] = [];
  const taken = new Set<string>();
  for (const r of runners) {
    if (r.scratched) continue;
    const lane: MapLane | null = alt ? r.altLane || r.lane : r.lane;
    const pos = alt ? (r.altLane ? r.altPosition : r.altPosition || r.position) : r.position;
    if ((lane !== "rail" && lane !== "outside") || !pos) continue;
    const k = `${lane}:${pos}`;
    if (taken.has(k)) continue; // two horses in one spot: the first keeps it
    taken.add(k);
    out.push({ r, lane, pos });
  }
  return out;
}

const settleOf = (r: MapRunner, p: Placed | undefined) => r.settle || (p ? posName(p.lane, p.pos) : null);

function dateLong(d?: string) {
  if (!d) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(",", "");
}
function dateShort(d?: string) {
  if (!d) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(",", "");
}
function localTime(iso?: string | null, tz?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso)
      .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || "Australia/Sydney" })
      .replace(/\s/g, "")
      .toLowerCase();
  } catch {
    return null;
  }
}
function stakesShort(n?: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `$${Number((n / 1_000_000).toFixed(2))}m`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}
// TAB race names end in "Ms" (mobile start) or "Ss" (standing start); readers do not need it.
const raceName = (n?: string | null) => (n || "").replace(/\s+(Ms|Ss)$/i, "").trim();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function silksOf(r: MapRunner): [string, string] {
  const spec = parseSilk(r.colours);
  return [r.silkMain || spec?.body || "#1d6fd8", r.silkTrim || spec?.second || "#ffffff"];
}

// The runner's TAB silks in its name tag; TAB drops the images a few days after
// a meeting, so the object falls back to silks drawn from TAB's colours.
function tagSilk(r: MapRunner) {
  const drawn = silkDataUrl(r.colours);
  const tab = silkUrl(r.silk);
  const img = drawn ? `<img class="tag-silk" src="${drawn}" alt="">` : "";
  if (tab) return `<object class="tag-silk" data="${esc(tab)}" type="image/png" aria-hidden="true">${img}</object>`;
  return img;
}

const BOARD = `<div class="board"><img class="mark" src="/racemap/mark.png" alt=""><img class="word" src="/racemap/word.png" alt="HarnessLink"></div>`;
const HEADS = ["Lead", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function mapHtml(data: RaceMapData, label: string, placed: Placed[]) {
  const race: NonNullable<RaceMapData["race"]> = data.race || {};
  const cols = Math.max(4, ...placed.map((p) => p.pos));
  const at = (lane: "rail" | "outside", c: number) => placed.find((p) => p.lane === lane && p.pos === c);
  const laneHtml = (lane: "rail" | "outside", text: string) => {
    let h = `<div class="lane"><span class="lane-label">${text}</span>`;
    for (let c = cols; c >= 1; c--) {
      const p = at(lane, c);
      const name = posName(lane, c);
      if (!p) {
        h += `<div class="slot"><span class="pos">${name}</span></div>`;
        continue;
      }
      const r = p.r;
      const [s1, s2] = silksOf(r);
      const no = r.no || 0;
      h +=
        `<div class="slot filled"><span class="pos">${name}</span><div class="horse" role="img" aria-label="${no} ${esc(r.horse)}, ${esc(settleOf(r, p) || name)}">` +
        rigSvg(coatFor(r.horse, r.coat), s1, s2, ((no || 1) * 0.37) % 1) +
        `<span class="tag">${no ? `<span class="sc sc-${no <= 16 ? no : "x"}" aria-hidden="true"><span>${no}</span></span>` : ""}${tagSilk(r)}<span class="name">${esc(r.horse)}</span></span></div></div>`;
    }
    return h + `</div>`;
  };
  const when = [race.venue, dateShort(race.date), localTime(race.startTime, race.timezone)].filter(Boolean).join(" | ");
  const meta = [
    race.distance ? `<div><b>${race.distance}m</b>${race.start ? `${race.start} start` : "distance"}</div>` : "",
    `<div><b>${race.runners || placed.length}</b>runners</div>`,
    race.stakes ? `<div><b>${stakesShort(race.stakes)}</b>${esc(race.className || "stake")}</div>` : "",
  ].join("");
  return (
    `<header class="band"><img class="logo" src="/racemap/logo.jpg" alt="HarnessLink">` +
    `<div class="title"><h3><small>${esc(label)}${when ? ` | ${esc(when)}` : ""}</small><span class="race">${race.no ? `R${race.no} ` : ""}${esc(data.heading?.replace(/\s*race map$/i, "") || raceName(race.name))}</span></h3></div>` +
    `<div class="meta">${meta}</div></header>` +
    `<div class="track-wrap"><div class="track" style="--cols:${cols}">` +
    `<div class="infield" aria-hidden="true">${BOARD}<div class="board wide"><span class="tag-line">Race maps by <em>HarnessLink</em></span></div>${BOARD}</div>` +
    `<div class="rail" aria-hidden="true"></div><div class="finish" aria-hidden="true"></div>` +
    `<div class="cols-head">${HEADS.slice(0, cols)
      .reverse()
      .map((t) => `<span>${t}</span>`)
      .join("")}</div>` +
    laneHtml("rail", "Rail line") +
    laneHtml("outside", "Outside line") +
    `</div></div>`
  );
}

function who(r: MapRunner) {
  const gate = r.barrier ? `Gate ${r.barrier}. ` : "";
  if (r.driver && r.trainer && r.driver === r.trainer) return `${gate}Trainer and driver ${r.driver}`;
  const people = [r.trainer && `Trainer ${r.trainer}`, r.driver && `driver ${r.driver}`].filter(Boolean).join(", ");
  return `${gate}${people}`.trim() || null;
}

function Comment({ text }: { text: string | null }) {
  return (
    <>
      {paras(text).map((p, i) =>
        p.startsWith(">") ? (
          <blockquote key={i}>
            <p>{p.replace(/^>\s*/, "")}</p>
          </blockquote>
        ) : (
          <p key={i}>{p}</p>
        )
      )}
    </>
  );
}

function Prose({ text }: { text: string | null }) {
  return (
    <>
      {paras(text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}

export default function RaceMap({ data }: { data: RaceMapData }) {
  const race: NonNullable<RaceMapData["race"]> = data.race || {};
  const expected = placements(data.runners, false);
  const alternative = data.showAlternative ? placements(data.runners, true) : [];
  const where = (r: MapRunner) => expected.find((p) => p.r === r);
  // Runner by runner follows the order of the runners in the editor (drag to
  // reorder there); scratched runners go last.
  const order = [...data.runners].sort((a, b) => (a.scratched ? 1 : 0) - (b.scratched ? 1 : 0));
  const meet = [race.venue, dateLong(race.date), race.no ? `Race ${race.no}` : null, localTime(race.startTime, race.timezone)].filter(Boolean).join(", ");
  const title = data.heading || (race.name ? `${raceName(race.name)} Race Map` : "Race Map");
  const field = [...data.runners].filter((r) => !r.scratched).sort((a, b) => (Number(a.barrier) || a.no || 99) - (Number(b.barrier) || b.no || 99));
  return (
    <section className="hl-rmp" aria-label={title}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs dangerouslySetInnerHTML={{ __html: coatDefs() }} />
      </svg>

      <header className="hero">
        <div className="hero-inner">
          {meet && <p className="meet">{meet}</p>}
          <div className="hero-title">{title}</div>
          {data.standfirst && <p className="standfirst">{data.standfirst}</p>}
        </div>
      </header>

      <section className="prose">
        <h2>The expected map</h2>
        <Prose text={data.expectedIntro} />
      </section>
      <figure className="rmap" aria-label="Expected race map" style={{ marginLeft: 0, marginRight: 0 }} dangerouslySetInnerHTML={{ __html: mapHtml(data, "Expected race map", expected) }} />
      <p className="map-cap">Expected settling positions, leader on the right.</p>

      <section className="prose">
        <Prose text={data.expectedAfter} />
        <h2>Runner by runner</h2>
      </section>
      <ol className="runners">
        {order.map((r, i) => {
          const p = where(r);
          const spot = r.scratched ? "Scratched" : settleOf(r, p);
          const line = who(r);
          return (
            <li className="rc" key={`${r.no}-${i}`} id={r.no ? `map-runner-${r.no}` : undefined}>
              {r.no ? (
                <span className={`sc sc-${r.no <= 16 ? r.no : "x"}`}>
                  <span>{r.no}</span>
                </span>
              ) : (
                <span />
              )}
              <div>
                <h3>
                  {r.horse}
                  {(r.silk || r.colours) && <Silk path={r.silk} colours={r.colours} alt="" size={28} />} {spot && <span className="spot">{spot}</span>}
                </h3>
                {line && <p className="who">{line}</p>}
                {r.scratched ? <p>Scratched.</p> : <Comment text={r.comment} />}
              </div>
            </li>
          );
        })}
      </ol>

      {data.showAlternative && alternative.length > 0 && (
        <>
          <section className="prose">
            <h2>The alternative map</h2>
            <Prose text={data.altIntro} />
          </section>
          <figure className="rmap" aria-label="Alternative race map" style={{ marginLeft: 0, marginRight: 0 }} dangerouslySetInnerHTML={{ __html: mapHtml(data, "Alternative race map", alternative) }} />
          <p className="map-cap">Alternative settling positions, leader on the right.</p>
          <section className="prose">
            <Prose text={data.altAfter} />
          </section>
        </>
      )}

      <section className="prose">
        <h2>The field at a glance</h2>
      </section>
      <div className="rm-table">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Horse</th>
              <th>Gate</th>
              <th>Trainer</th>
              <th>Driver</th>
              <th>TAB fixed</th>
              <th>Expected settle</th>
            </tr>
          </thead>
          <tbody>
            {field.map((r, i) => (
              <tr key={`${r.no}-${i}`}>
                <td>
                  {r.no ? (
                    <span className={`sc sc--sm sc-${r.no <= 16 ? r.no : "x"}`}>
                      <span>{r.no}</span>
                    </span>
                  ) : null}
                </td>
                <td className="h">
                  <span className="h-cell">
                    {(r.silk || r.colours) && <Silk path={r.silk} colours={r.colours} alt="" size={22} />}
                    {r.horse}
                  </span>
                </td>
                <td>{r.barrier || "–"}</td>
                <td>{r.trainer || "–"}</td>
                <td>{r.driver || "–"}</td>
                <td>{r.odds || "–"}</td>
                <td>{settleOf(r, where(r)) || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.footnote && (
        <div className="foot">
          {data.footnote
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l, i) => (
              <p key={i}>{l}</p>
            ))}
        </div>
      )}
    </section>
  );
}
