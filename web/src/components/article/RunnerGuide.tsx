import { Silk } from "@/components/analysis/SpeedMap";
import type { RunnerGuide as Guide, RunnerCard, RunnerRace } from "@/lib/api";

// Runner guide under a story: the Harnesslink runner cards exactly as on the
// live TAB Eureka "case for and against every runner" page (markup and
// classes as there; styles in globals.css under "Runner guide"). Edited in
// Strapi under the story's Runner guide; facts filled from the racing data.

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

const anchor = (c: RunnerCard) =>
  c.horse
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "") || `runner-${c.no}`;

function barrierWords(b: string | null) {
  if (!b) return null;
  const n = Number(b);
  return Number.isInteger(n) && WORDS[n] ? `barrier ${WORDS[n]}` : `barrier ${b}`;
}

function money(n: number | null | undefined) {
  if (!n) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : Number(m.toFixed(2))} million`;
  }
  return `$${n.toLocaleString("en-AU")}`;
}

function localTime(iso: string | null | undefined, tz: string | null | undefined) {
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

function dateLabel(d: string | undefined) {
  if (!d) return null;
  const dt = new Date(`${d}T12:00:00Z`);
  const wd = dt.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  const md = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${wd}, ${md}`;
}

function Cloth({ no }: { no: number | null }) {
  if (!no) return null;
  return (
    <span className={`sc sc-${no <= 16 ? no : "x"}`}>
      <span>{no}</span>
    </span>
  );
}

function Silks({ c, size, alt }: { c: RunnerCard; size: number; alt: string }) {
  if (c.silksImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.silksImage} alt={alt} width={size} height={size} loading="lazy" />;
  }
  if (!c.silk && !c.colours) return null;
  return <Silk path={c.silk} colours={c.colours} alt={alt} size={size} />;
}

const paras = (s: string | null) =>
  (s || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function Header({ guide, race }: { guide: Guide; race: RunnerRace | null }) {
  const time = localTime(race?.startTime, race?.timezone);
  const kicker = [race?.venue, race?.no ? `Race ${race.no}` : null, time].filter(Boolean).join(", ");
  const title = guide.heading || race?.name || "Runner by runner";
  const runners = race?.runners || guide.cards.length;
  const stats = [
    ["Date", dateLabel(race?.date)],
    ["Track", race?.venue],
    ["Distance", race?.distance ? `${race.distance}m` : null],
    ["Prize money", money(race?.stakes)],
    ["Field", runners ? `${runners} runners` : null],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <header className="hl-ef__head">
      <div className="hl-ef__top">
        {kicker && <p className="hl-ef__kicker">{kicker}</p>}
        <h2 className="hl-ef__title">{title}</h2>
        {guide.intro && <p className="hl-ef__intro">{guide.intro}</p>}
      </div>
      {stats.length > 0 && (
        <ul className="hl-ef__stats" style={stats.length !== 5 ? { gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` } : undefined}>
          {stats.map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </li>
          ))}
        </ul>
      )}
      <nav className="hl-ef__jump" aria-label="Jump to a runner">
        <p>Jump to a runner</p>
        {guide.cards.map((c, i) => (
          <a key={`${anchor(c)}-${i}`} href={`#${anchor(c)}`}>
            <Cloth no={c.no} />
            <Silks c={c} size={26} alt="" />
            {c.horse}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Card({ c }: { c: RunnerCard }) {
  const small = [c.ageSex, barrierWords(c.barrier)].filter(Boolean).join(", ");
  const people = [
    ["Driver", c.driver],
    ["Trainer", c.trainer],
    ["Slot", c.slotHolder],
  ].filter(([, v]) => v) as [string, string][];
  const comment = paras(c.comment);
  return (
    <article className="hl-rc" id={anchor(c)}>
      <header className="hl-rc__band">
        <Cloth no={c.no} />
        <div className="hl-rc__title">
          <h3>{c.horse}</h3>
          {small && <small>{small}</small>}
        </div>
        {c.odds ? (
          <div className="hl-rc__odds">
            <b>{c.odds}</b>
            <span>TAB win</span>
          </div>
        ) : (
          <span />
        )}
        <div className="hl-rc__silks">
          <Silks c={c} size={78} alt={c.slotHolder ? `${c.slotHolder} slot silks` : `${c.horse} silks`} />
        </div>
      </header>
      {people.length > 0 && (
        <dl className="hl-rc__people" style={people.length !== 3 ? { gridTemplateColumns: `repeat(${people.length}, minmax(0, 1fr))` } : undefined}>
          {people.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {(c.forCase || c.againstCase) && (
        <div className="hl-rc__case">
          {c.forCase && (
            <div>
              <span className="hl-rc__tag hl-rc__tag--for">For</span>
              <p>{c.forCase}</p>
            </div>
          )}
          {c.againstCase && (
            <div>
              <span className="hl-rc__tag hl-rc__tag--ag">Against</span>
              <p>{c.againstCase}</p>
            </div>
          )}
        </div>
      )}
      {comment.length > 0 && (
        <div className="hl-rc__comment">
          <h4>HL comment</h4>
          {comment.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </article>
  );
}

export default function RunnerGuide({ guide }: { guide: Guide }) {
  const emg = paras(guide.emergencies);
  const notes = (guide.footnote || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <section className="hl-ef mt-9" aria-label={`${guide.heading || guide.race?.name || "Race"} runner guide`}>
      <Header guide={guide} race={guide.race} />
      {guide.cards.map((c, i) => (
        <Card key={`${anchor(c)}-${i}`} c={c} />
      ))}
      {emg.length > 0 && (
        <aside className="hl-ef__emg">
          <h4>Emergencies</h4>
          {emg.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </aside>
      )}
      {notes.length > 0 && (
        <div className="hl-ef__note">
          {notes.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </section>
  );
}
