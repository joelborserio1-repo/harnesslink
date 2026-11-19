import { Silk } from "@/components/analysis/SpeedMap";
import type { RunnerGuide as Guide, RunnerCard } from "@/lib/api";

// Runner cards under a story ("the case for and against every runner"),
// edited in Strapi under the story's Runner guide. Facts box with the
// saddlecloth and silks, then For / Against, then our comment.

// Saddlecloth colours by number (background, text). One place to change them.
const CLOTH: Record<number, [string, string]> = {
  1: ["#d71920", "#fff"],
  2: ["#000", "#fff"],
  3: ["#fff", "#000"],
  4: ["#1e4fb5", "#fff"],
  5: ["#ffd200", "#000"],
  6: ["#0a8a3a", "#fff"],
  7: ["#6a2c91", "#fff"],
  8: ["#e85a9b", "#fff"],
  9: ["#00a3ad", "#fff"],
  10: ["#8a8d91", "#fff"],
  11: ["#f47b20", "#fff"],
  12: ["#7b4a26", "#fff"],
};

function Cloth({ no }: { no: number | null }) {
  if (!no) return null;
  const [bg, fg] = CLOTH[no] || ["#0b1f3a", "#fff"];
  return (
    <span className="rc-no" style={{ background: bg, color: fg }} aria-label={`Number ${no}`}>
      {no}
    </span>
  );
}

function Card({ c }: { c: RunnerCard }) {
  const label = [c.barrier && `Barrier ${c.barrier}`, c.slotHolder && `Slot: ${c.slotHolder}`].filter(Boolean).join(" \u00b7 ");
  const meta = [c.ageSex, c.driver && `Driver ${c.driver}`, c.trainer && `Trainer ${c.trainer}`].filter(Boolean) as string[];
  const paras = (c.comment || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <article className="rc" id={c.no ? `runner-${c.no}` : undefined}>
      <div className="rc-silks">
        {c.silksImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rc-silks-upload" src={c.silksImage} alt={`${c.horse} silks`} width={64} height={64} loading="lazy" />
        ) : (
          <Silk path={c.silk} colours={c.colours} alt={`${c.horse} silks`} size={52} />
        )}
      </div>
      <div className="rc-body">
        <div className="rc-top">
          <div className="rc-title">
            {label && <span className="rc-label">{label}</span>}
            <h3 className="rc-horse">
              <Cloth no={c.no} />
              {c.horse}
            </h3>
            {meta.length > 0 && <p className="rc-meta">{meta.join(" \u00b7 ")}</p>}
          </div>
          {c.odds && (
            <div className="rc-odds">
              <span className="rc-odds-label">Odds</span>
              {c.odds}
            </div>
          )}
        </div>
        {(c.forCase || c.againstCase) && (
          <dl className="rc-case">
            {c.forCase && (
              <div className="rc-for">
                <dt>For</dt>
                <dd>{c.forCase}</dd>
              </div>
            )}
            {c.againstCase && (
              <div className="rc-against">
                <dt>Against</dt>
                <dd>{c.againstCase}</dd>
              </div>
            )}
          </dl>
        )}
        {paras.length > 0 && (
          <div className="rc-comment">
            <span className="rc-label">HL comment</span>
            {paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function RunnerGuide({ guide }: { guide: Guide }) {
  return (
    <section className="runner-guide" aria-label={guide.heading || "Runner guide"}>
      {guide.heading && <h2 className="rc-heading">{guide.heading}</h2>}
      {guide.cards.map((c, i) => (
        <Card key={`${c.no}-${c.horse}-${i}`} c={c} />
      ))}
      {guide.footnote && (
        <div className="rc-footnote">
          {guide.footnote.split(/\n+/).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </section>
  );
}
