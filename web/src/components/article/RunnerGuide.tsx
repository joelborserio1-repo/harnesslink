import { Silk } from "@/components/analysis/SpeedMap";
import type { RunnerGuide as Guide, RunnerCard } from "@/lib/api";

// Runner guide under a story, in the house race-map style (the TAB Eureka and
// Christian Cullen race maps): "Runner by runner" with HRNSW saddlecloths,
// then "The field at a glance". Edited in Strapi under the story's Runner guide.

function Cloth({ no, small = false }: { no: number | null; small?: boolean }) {
  if (!no) return <span className={`sc sc-none${small ? " sc--sm" : ""}`} aria-hidden />;
  return (
    <span className={`sc sc-${no <= 16 ? no : "x"}${small ? " sc--sm" : ""}`} aria-label={`Number ${no}`}>
      <span>{no}</span>
    </span>
  );
}

function Silks({ c, size }: { c: RunnerCard; size: number }) {
  if (c.silksImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="rg-silks-upload" src={c.silksImage} alt={`${c.horse} silks`} width={size} height={size} loading="lazy" />;
  }
  if (!c.silk && !c.colours) return null;
  return <Silk path={c.silk} colours={c.colours} alt={`${c.horse} silks`} size={size} />;
}

function who(c: RunnerCard) {
  const first = [c.barrier && `Draw ${c.barrier}`, c.ageSex].filter(Boolean).join(", ");
  const people = [c.trainer && `Trainer ${c.trainer}`, c.driver && `driver ${c.driver}`].filter(Boolean).join(", ");
  return [first, people, c.odds && `${c.odds} win`].filter(Boolean).map((s) => `${s}.`).join(" ");
}

function Runner({ c }: { c: RunnerCard }) {
  const paras = (c.comment || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const line = who(c);
  return (
    <li className="rg-rc" id={c.no ? `runner-${c.no}` : undefined}>
      <Cloth no={c.no} />
      <div>
        <h3>
          <span className="rg-nm">{c.horse}</span>
          <Silks c={c} size={30} />
          {c.slotHolder && <span className="rg-spot">Slot: {c.slotHolder}</span>}
        </h3>
        {line && <p className="rg-who">{line}</p>}
        {c.forCase && (
          <p className="rg-fa">
            <span className="rg-for">For</span> {c.forCase}
          </p>
        )}
        {c.againstCase && (
          <p className="rg-fa">
            <span className="rg-against">Against</span> {c.againstCase}
          </p>
        )}
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </li>
  );
}

export default function RunnerGuide({ guide }: { guide: Guide }) {
  const slots = guide.cards.some((c) => c.slotHolder);
  return (
    <section className="rg" aria-label={guide.heading || "Runner by runner"}>
      <h2>{guide.heading || "Runner by runner"}</h2>
      <ol className="rg-runners">
        {guide.cards.map((c, i) => (
          <Runner key={`${c.no}-${c.horse}-${i}`} c={c} />
        ))}
      </ol>

      <h2>The field at a glance</h2>
      <div className="rg-table">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Horse</th>
              <th>Gate</th>
              <th>Trainer</th>
              <th>Driver</th>
              {slots && <th>Slot</th>}
              <th>Win</th>
            </tr>
          </thead>
          <tbody>
            {guide.cards.map((c, i) => (
              <tr key={`${c.no}-${c.horse}-${i}`}>
                <td>
                  <Cloth no={c.no} small />
                </td>
                <td className="rg-h">
                  <span className="rg-hcell">
                    <Silks c={c} size={22} />
                    {c.horse}
                  </span>
                </td>
                <td>{c.barrier || "–"}</td>
                <td>{c.trainer || "–"}</td>
                <td>{c.driver || "–"}</td>
                {slots && <td>{c.slotHolder || "–"}</td>}
                <td>{c.odds || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {guide.footnote && (
        <div className="rg-foot">
          {guide.footnote.split(/\n+/).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </section>
  );
}
