import Link from "next/link";
import {
  COUNTRY_NAMES,
  SCOPES,
  applyFilters,
  formatMonth,
  formatRaceDate,
  formatStakes,
  options,
  parseFilters,
  racesFor,
  today,
  type Scope,
} from "@/lib/raceCalendar";

const PER_PAGE = 60;

type SearchParams = Record<string, string | string[] | undefined>;

function Select({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="kicker !text-muted">{label}</span>
      <select name={name} defaultValue={value} className="border border-line bg-white px-2.5 py-2 text-[14px] text-ink">
        {children}
      </select>
    </label>
  );
}

// The feature race calendar page for one scope (a country, or INTL for all).
// Server-rendered from the query string — no client JavaScript.
export default function RaceCalendar({ scope, searchParams }: { scope: Scope; searchParams: SearchParams }) {
  const meta = SCOPES.find((s) => s.scope === scope)!;
  const all = racesFor(scope);
  const opts = options(all);
  const f = parseFilters(searchParams);
  const now = today();
  const rows = applyFilters(all, f, now);

  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const showCountry = scope === "INTL";
  const showRegion = opts.regions.length > 1;
  const showDistance = visible.some((r) => r.distance);
  const groupOnes = all.filter((r) => r.grade === "G1" && r.date >= now).slice(0, 8);

  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string> = { ...f, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "view" && v === "upcoming")) q.set(k, v);
    }
    const s = q.toString();
    return s ? `${meta.path}?${s}` : meta.path;
  };

  const filtered = Boolean(f.country || f.region || f.gait || f.grade || f.month || f.q);

  return (
    <div className="wrap py-7">
      <header className="mb-6">
        <p className="kicker kicker-gold">Racing</p>
        <h1 className="font-headline mt-1 text-[34px] font-bold leading-[1.05] text-navy [text-wrap:balance] sm:text-[46px]">
          {meta.title}
        </h1>
        <p className="mt-3 max-w-[70ch] text-[15px] text-[#474b54]">
          Group and feature races for pacers and trotters, with dates, venues, classes and stakes.
          {scope === "INTL" ? " Australia, New Zealand, the United States and Canada in one calendar." : ""}
        </p>
        <nav aria-label="Calendars" className="mt-5 flex flex-wrap gap-x-7 border-b border-line">
          {SCOPES.map((s) => (
            <Link
              key={s.scope}
              href={s.path}
              aria-current={s.scope === scope ? "page" : undefined}
              className={`-mb-px border-b-[3px] py-2.5 text-[13px] font-bold uppercase tracking-[0.12em] ${
                s.scope === scope ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="sheet min-w-0 p-5 sm:p-6">
          <form action={meta.path} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select name="view" label="Show" value={f.view}>
              <option value="upcoming">Upcoming races</option>
              <option value="all">Whole season</option>
            </Select>
            {showCountry && (
              <Select name="country" label="Country" value={f.country}>
                <option value="">All countries</option>
                {opts.countries.map((c) => (
                  <option key={c} value={c}>{COUNTRY_NAMES[c]}</option>
                ))}
              </Select>
            )}
            {showRegion && (
              <Select name="region" label={scope === "AU" ? "State" : "State / province"} value={f.region}>
                <option value="">All</option>
                {opts.regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            )}
            <Select name="month" label="Month" value={f.month}>
              <option value="">Any month</option>
              {opts.months.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </Select>
            <Select name="gait" label="Gait" value={f.gait}>
              <option value="">Pace and trot</option>
              {opts.gaits.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
            <Select name="grade" label="Grade" value={f.grade}>
              <option value="">All grades</option>
              {opts.grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <span className="kicker !text-muted">Race or venue</span>
              <input
                type="search"
                name="q"
                defaultValue={f.q}
                placeholder="e.g. Miracle Mile, Menangle"
                className="border border-line bg-white px-2.5 py-2 text-[14px]"
              />
            </label>
            <div className="flex items-end gap-4">
              <button className="btn">Apply</button>
              {filtered && (
                <Link href={href({ country: "", region: "", gait: "", grade: "", month: "", q: "" })} className="pb-2.5 text-[13px] font-semibold text-navy underline underline-offset-2">
                  Clear
                </Link>
              )}
            </div>
          </form>

          <p className="meta mt-6 border-t border-line pt-4" aria-live="polite">
            <b>{rows.length.toLocaleString("en-AU")}</b> {rows.length === 1 ? "race" : "races"}
            {f.view === "upcoming" ? " still to come" : " this season"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </p>

          {rows.length === 0 ? (
            <p className="py-10 text-[15px] text-[#474b54]">
              No races match those filters.{" "}
              <Link href={href({ view: "all" })} className="font-semibold text-navy underline underline-offset-2">
                Show the whole season
              </Link>{" "}
              or clear a filter.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-b-2 border-navy text-[11px] uppercase tracking-[0.1em] text-navy">
                    <th className="py-2 pr-3 font-bold">Date</th>
                    <th className="py-2 pr-3 font-bold">Race</th>
                    <th className="py-2 pr-3 font-bold">Venue</th>
                    <th className="py-2 pr-3 font-bold">Class</th>
                    <th className="py-2 pr-3 font-bold">Gait</th>
                    <th className="py-2 pr-3 font-bold">Grade</th>
                    {showDistance && <th className="py-2 pr-3 text-right font-bold">Dist.</th>}
                    <th className="py-2 text-right font-bold">Stakes</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={`${r.date}-${r.race}-${r.klass}-${i}`} className="border-b border-line align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-[#33363d]">
                        {formatRaceDate(r.date)}
                        {r.rescheduled && <span className="block text-[11px] font-semibold text-red">Rescheduled</span>}
                      </td>
                      <td className="py-2.5 pr-3 font-headline text-[15px] font-bold text-navy">{r.race}</td>
                      <td className="py-2.5 pr-3 text-[#33363d]">
                        {r.track}
                        <span className="block text-[12px] text-muted">
                          {[r.region !== "NZ" ? r.region : "", showCountry ? COUNTRY_NAMES[r.country] : ""].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[#33363d]">{r.klass || "N/A"}</td>
                      <td className="py-2.5 pr-3 text-[#33363d]">{r.gait}</td>
                      <td className={`py-2.5 pr-3 font-bold ${r.grade === "G1" ? "text-accent" : "text-[#33363d]"}`}>{r.grade || "—"}</td>
                      {showDistance && (
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-[#33363d]">
                          {r.distance ? `${r.distance}m` : "—"}
                        </td>
                      )}
                      <td className="whitespace-nowrap py-2.5 text-right font-semibold tabular-nums text-ink">{formatStakes(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[13px] font-bold uppercase tracking-[0.1em]">
              {page > 1 ? <Link href={href({ page: String(page - 1) })} className="text-navy hover:text-blue">← Earlier</Link> : <span />}
              {page < pages ? <Link href={href({ page: String(page + 1) })} className="text-navy hover:text-blue">Later →</Link> : <span />}
            </nav>
          )}

          <p className="mt-5 text-[12.5px] leading-relaxed text-muted">
            Stakes are shown in {meta.currency}. Dates and conditions are set by each racing authority and can
            change — confirm with the club before travelling.
          </p>
        </div>

        <aside className="flex flex-col gap-7 lg:sticky lg:top-4">
          <section className="sheet p-5">
            <h2 className="rule-head font-headline text-[19px] font-bold text-navy">Upcoming Group 1 races</h2>
            {groupOnes.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">No Group 1 races remain on this calendar.</p>
            ) : (
              <ol className="mt-1">
                {groupOnes.map((r, i) => (
                  <li key={`${r.date}-${r.race}-${i}`} className="border-b border-line py-3 last:border-b-0 last:pb-0">
                    <p className="meta">
                      <b>{formatRaceDate(r.date)}</b>
                    </p>
                    <p className="font-headline mt-1 text-[15px] font-bold leading-snug text-navy">{r.race}</p>
                    <p className="mt-0.5 text-[13px] text-[#474b54]">
                      {r.track}
                      {showCountry ? `, ${COUNTRY_NAMES[r.country]}` : r.region !== "NZ" ? `, ${r.region}` : ""} · {formatStakes(r)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
