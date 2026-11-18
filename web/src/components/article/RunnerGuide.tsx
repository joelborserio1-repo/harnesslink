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

function Fact({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rc-cell ${className}`}>
      <span className="rc-label">{label}</span>
      <span className="rc-value">{children}</span>
    </div>
  );
}

function Card({ c }: { c: RunnerCard }) {
  const second = [
    c.driver && ["Driver", c.driver],
    c.trainer && ["Trainer", c.trainer],
    c.slotHolder ? ["Slot", c.slotHolder] : c.barrier ? ["Barrier", c.barrier] : null,
  ].filter(Boolean) as [string, string][];
  const paras = (c.comment || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <article className="rc" id={c.no ? `runner-${c.no}` : undefined}>
      <div className="rc-head">
        <div className="rc-facts-wrap">
          <div className="rc-facts">
            <Fact label="Horse" className="rc-cell-horse">
              <span className="rc-horse">
                <Cloth no={c.no} />
                {c.horse}
              </span>
            </Fact>
            <Fact label="Age / Sex">{c.ageSex || "–"}</Fact>
            <Fact label="Odds">
              <span className="rc-odds">{c.odds || "–"}</span>
            </Fact>
          </div>
          {second.length > 0 && (
            <div className="rc-facts">
              {second.map(([k, v]) => (
                <Fact key={k} label={k}>
                  {v}
                </Fact>
              ))}
            </div>
          )}
        </div>
        <div className="rc-silks">
          {c.silksImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="rc-silks-upload" src={c.silksImage} alt={`${c.horse} silks`} width={96} height={96} loading="lazy" />
          ) : (
            <Silk path={c.silk} colours={c.colours} alt={`${c.horse} silks`} size={58} />
          )}
        </div>
      </div>
      {(c.forCase || c.againstCase) && (
        <table className="rc-case">
          <tbody>
            {c.forCase && (
              <tr className="rc-for">
                <th scope="row">For</th>
                <td>{c.forCase}</td>
              </tr>
            )}
            {c.againstCase && (
              <tr className="rc-against">
                <th scope="row">Against</th>
                <td>{c.againstCase}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {paras.length > 0 && (
        <div className="rc-comment">
          {paras.map((p, i) => (
            <p key={i}>
              {i === 0 && <strong>HL comment &ndash; </strong>}
              {p}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

export default function RunnerGuide({ guide }: { guide: Guide }) {
  return (
    <section className="runner-guide mt-9" aria-label={guide.heading || "Runner guide"}>
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
