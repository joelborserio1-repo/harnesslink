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
  type Race,
  type Scope,
} from "@/lib/raceCalendar";

// The feature race calendar for one scope (a country, or INTL for all).
// Server-rendered from the query string — no client JavaScript.
//
// Two views: a month calendar (the default; ‹ › between months, races on each
// day, Group 1s in gold) and a sortable-by-date list. Filters apply to both.
// On phones the month is shown as a day-by-day agenda, which reads better
// than a seven-column grid.

const PER_PAGE = 60;
const PER_CELL = 4;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type SearchParams = Record<string, string | string[] | undefined>;

function Select({ name, label, value, children }: { name: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="kicker !text-muted">{label}</span>
      <select name={name} defaultValue={value} className="border border-line bg-white px-2.5 py-2 text-[14px] text-ink">
        {children}
      </select>
    </label>
  );
}

function Grade({ grade }: { grade: string }) {
  if (!grade) return null;
  const tone =
    grade === "G1"
      ? "bg-accent text-white"
      : grade === "G2"
        ? "bg-navy text-white"
        : grade === "G3"
          ? "border border-navy text-navy"
          : "border border-line text-muted";
  // One fixed width so race names line up; long grades are abbreviated
  // (full name on hover), as on the old calendar.
  const short = SHORT[grade] ?? (grade.length > 3 ? grade.slice(0, 3) : grade);
  return (
    <span
      title={NAMES[grade] ?? grade}
      className={`font-ui inline-flex h-[18px] w-[28px] shrink-0 items-center justify-center text-[10px] font-bold leading-none tracking-[0.02em] ${tone}`}
    >
      {short}
    </span>
  );
}

const SHORT: Record<string, string> = { Listed: "L", Feature: "F", Prelude: "P", Semi: "SF", NG: "–" };
const NAMES: Record<string, string> = {
  G1: "Group 1",
  G2: "Group 2",
  G3: "Group 3",
  Listed: "Listed race",
  Feature: "Feature race",
  Prelude: "Prelude",
  Semi: "Semi-final",
  NG: "No grade",
  SSH: "Sires stakes heat",
};

const shift = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// Weeks (Mon–Sun) covering a month, as yyyy-mm-dd strings.
function weeksOf(ym: string): string[][] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const last = new Date(Date.UTC(y, m, 0));
  const weeks: string[][] = [];
  for (const d = new Date(start); d <= last || weeks.at(-1)?.length !== 7; d.setUTCDate(d.getUTCDate() + 1)) {
    if (!weeks.length || weeks.at(-1)!.length === 7) weeks.push([]);
    weeks.at(-1)!.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

const rank = (r: Race) => ({ G1: 0, G2: 1, G3: 2, Listed: 3 })[r.grade] ?? 4;

function RaceLine({ r, showCountry }: { r: Race; showCountry: boolean }) {
  return (
    <li className="flex gap-1.5">
      <Grade grade={r.grade} />
      <span className="min-w-0">
        <span className={`block text-[12.5px] font-semibold leading-snug ${r.grade === "G1" ? "text-accent" : "text-navy"}`}>{r.race}</span>
        <span className="block truncate text-[11px] leading-snug text-muted">
          {r.track}
          {showCountry ? ` · ${r.country}` : ""}
        </span>
      </span>
    </li>
  );
}

function MonthGrid({ month, byDay, now, showCountry }: { month: string; byDay: Map<string, Race[]>; now: string; showCountry: boolean }) {
  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-7 border-l border-t border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="font-ui border-b-2 border-r border-b-navy border-r-line bg-white px-2 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-navy">
            {d}
          </div>
        ))}
        {weeksOf(month).flat().map((day) => {
          const inMonth = day.startsWith(month);
          const races = byDay.get(day) || [];
          const isToday = day === now;
          return (
            <div key={day} className={`min-h-[118px] border-b border-r border-line p-2 ${inMonth ? "bg-white" : "bg-mist"} ${day < now && inMonth ? "[&_ul]:opacity-60" : ""}`}>
              <p className="flex items-center justify-between">
                <span
                  className={`font-ui grid h-6 min-w-6 place-items-center text-[13px] font-bold tabular-nums ${
                    isToday ? "bg-navy px-1 text-white" : inMonth ? "text-ink" : "text-muted/60"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                {races.length > 0 && inMonth && <span className="text-[10px] font-semibold text-muted">{races.length}</span>}
              </p>
              {inMonth && races.length > 0 && (
                <>
                  <ul className="mt-1.5 space-y-1.5">
                    {races.slice(0, PER_CELL).map((r, i) => (
                      <RaceLine key={`${r.race}-${i}`} r={r} showCountry={showCountry} />
                    ))}
                  </ul>
                  {races.length > PER_CELL && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer list-none text-[11px] font-bold text-blue hover:underline">+{races.length - PER_CELL} more</summary>
                      <ul className="mt-1.5 space-y-1.5">
                        {races.slice(PER_CELL).map((r, i) => (
                          <RaceLine key={`${r.race}-m${i}`} r={r} showCountry={showCountry} />
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ month, byDay, now, showCountry }: { month: string; byDay: Map<string, Race[]>; now: string; showCountry: boolean }) {
  const days = [...byDay.keys()].filter((d) => d.startsWith(month)).sort();
  return (
    <ol className="md:hidden">
      {days.map((day) => (
        <li key={day} className="border-b border-line py-3">
          <p className={`meta ${day === now ? "!text-navy" : ""}`}>
            <b>{dayLabel(day)}</b>
            {day === now ? " · Today" : ""}
          </p>
          <ul className="mt-2 space-y-2">
            {byDay.get(day)!.map((r, i) => (
              <li key={`${r.race}-${i}`} className="flex gap-2">
                <Grade grade={r.grade} />
                <span className="min-w-0">
                  <span className={`block text-[14px] font-semibold leading-snug ${r.grade === "G1" ? "text-accent" : "text-navy"}`}>{r.race}</span>
                  <span className="block text-[12px] text-muted">
                    {r.track}
                    {showCountry ? `, ${COUNTRY_NAMES[r.country]}` : ""} · {formatStakes(r)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export default function RaceCalendar({ scope, searchParams }: { scope: Scope; searchParams: SearchParams }) {
  const meta = SCOPES.find((s) => s.scope === scope)!;
  const all = racesFor(scope);
  const opts = options(all);
  const f = parseFilters(searchParams);
  const now = today();
  const one = (k: string) => {
    const v = searchParams[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const display: "calendar" | "list" = one("display") === "list" ? "list" : "calendar";
  const showCountry = scope === "INTL";
  const showRegion = opts.regions.length > 1;

  // Calendar: one month at a time (the month filter, else this month), past
  // days included. List: the usual upcoming / whole-season filter.
  const thisMonth = now.slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(f.month) ? f.month : thisMonth;
  const rows = display === "calendar" ? applyFilters(all, { ...f, view: "all", month }, now) : applyFilters(all, f, now);

  const byDay = new Map<string, Race[]>();
  if (display === "calendar") {
    for (const r of rows) if (r.date) byDay.set(r.date, [...(byDay.get(r.date) || []), r]);
    for (const list of byDay.values()) list.sort((a, b) => rank(a) - rank(b) || (b.stakes ?? 0) - (a.stakes ?? 0));
  }
  const tbc = display === "calendar" ? applyFilters(all, { ...f, view: "all", month: "" }, now).filter((r) => !r.date).length : 0;

  const pageParam = one("page");
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const showDistance = visible.some((r) => r.distance);
  const groupOnes = all.filter((r) => r.grade === "G1" && r.date >= now).slice(0, 8);

  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string> = { ...f, display, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (!v || (k === "view" && v === "upcoming") || (k === "display" && v === "calendar")) continue;
      q.set(k, v);
    }
    const s = q.toString();
    return s ? `${meta.path}?${s}` : meta.path;
  };
  const filtered = Boolean(f.country || f.region || f.gait || f.grade || f.q || (display === "list" && f.month));

  return (
    <div className="wrap py-7">
      <header className="mb-6">
        <p className="kicker kicker-gold">Racing</p>
        <h1 className="font-headline mt-1 text-[34px] font-bold leading-[1.05] text-navy [text-wrap:balance] sm:text-[46px]">{meta.title}</h1>
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

      <div className={`grid gap-8 ${display === "list" ? "xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start" : ""}`}>
        <div className="sheet min-w-0 p-5 sm:p-6">
          <form action={meta.path} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="display" value={display === "list" ? "list" : ""} />
            {display === "calendar" && <input type="hidden" name="month" value={month} />}
            {display === "list" && (
              <Select name="view" label="Show" value={f.view}>
                <option value="upcoming">Upcoming races</option>
                <option value="all">Whole season</option>
              </Select>
            )}
            {showCountry && (
              <Select name="country" label="Country" value={f.country}>
                <option value="">All countries</option>
                {opts.countries.map((c) => (
                  <option key={c} value={c}>
                    {COUNTRY_NAMES[c]}
                  </option>
                ))}
              </Select>
            )}
            {showRegion && (
              <Select name="region" label={scope === "AU" ? "State" : "State / province"} value={f.region}>
                <option value="">All</option>
                {opts.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            )}
            {display === "list" && (
              <Select name="month" label="Month" value={f.month}>
                <option value="">Any month</option>
                {opts.months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </Select>
            )}
            <Select name="gait" label="Gait" value={f.gait}>
              <option value="">Pace and trot</option>
              {opts.gaits.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <Select name="grade" label="Grade" value={f.grade}>
              <option value="">All grades</option>
              {opts.grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="kicker !text-muted">Race or venue</span>
              <input type="search" name="q" defaultValue={f.q} placeholder="e.g. Miracle Mile, Menangle" className="border border-line bg-white px-2.5 py-2 text-[14px]" />
            </label>
            <div className="flex items-end gap-4">
              <button className="btn">Apply</button>
              {filtered && (
                <Link href={href({ country: "", region: "", gait: "", grade: "", month: display === "calendar" ? month : "", q: "" })} className="pb-2.5 text-[13px] font-semibold text-navy underline underline-offset-2">
                  Clear
                </Link>
              )}
            </div>
          </form>

          {/* View switch + month navigation */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-[3px] border-navy pt-4">
            {display === "calendar" ? (
              <div className="flex items-center gap-3">
                <Link href={href({ month: shift(month, -1), page: "" })} aria-label="Previous month" className="grid h-9 w-9 place-items-center border border-line text-navy hover:border-navy">
                  ‹
                </Link>
                <h2 className="font-headline min-w-[190px] text-center text-[24px] font-bold text-navy sm:text-[28px]">{formatMonth(month)}</h2>
                <Link href={href({ month: shift(month, 1), page: "" })} aria-label="Next month" className="grid h-9 w-9 place-items-center border border-line text-navy hover:border-navy">
                  ›
                </Link>
                {month !== thisMonth && (
                  <Link href={href({ month: thisMonth, page: "" })} className="font-ui ml-1 text-[12px] font-bold uppercase tracking-[0.1em] text-blue hover:underline">
                    Today
                  </Link>
                )}
              </div>
            ) : (
              <p className="meta" aria-live="polite">
                <b>{rows.length.toLocaleString("en-AU")}</b> {rows.length === 1 ? "race" : "races"}
                {f.view === "upcoming" ? " still to come" : " this season"}
                {pages > 1 && ` · page ${page} of ${pages}`}
              </p>
            )}
            <div className="flex border border-navy" role="tablist" aria-label="View">
              {(["calendar", "list"] as const).map((v) => (
                <Link
                  key={v}
                  href={href({ display: v, month: v === "calendar" ? month : "", page: "" })}
                  aria-current={display === v ? "page" : undefined}
                  className={`font-ui px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] ${display === v ? "bg-navy text-white" : "bg-white text-navy hover:bg-mist"}`}
                >
                  {v === "calendar" ? "Calendar" : "List"}
                </Link>
              ))}
            </div>
          </div>

          {display === "calendar" ? (
            <div className="mt-4">
              <p className="meta mb-3" aria-live="polite">
                <b>{rows.filter((r) => r.date).length}</b> {rows.length === 1 ? "race" : "races"} in {formatMonth(month)}
                {" · "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <Grade grade="G1" /> Group 1
                </span>{" "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <Grade grade="G2" /> Group 2
                </span>{" "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <Grade grade="G3" /> Group 3
                </span>
              </p>
              {byDay.size === 0 ? (
                <p className="border border-line bg-white px-5 py-10 text-center text-[15px] text-[#474b54]">
                  No races in {formatMonth(month)}
                  {filtered ? " with those filters" : ""}.{" "}
                  <Link href={href({ month: shift(month, 1) })} className="font-semibold text-navy underline underline-offset-2">
                    Next month →
                  </Link>
                </p>
              ) : (
                <>
                  <MonthGrid month={month} byDay={byDay} now={now} showCountry={showCountry} />
                  <Agenda month={month} byDay={byDay} now={now} showCountry={showCountry} />
                </>
              )}
              {tbc > 0 && (
                <p className="mt-4 text-[13px] text-muted">
                  {tbc} {tbc === 1 ? "race has" : "races have"} a date still to be confirmed —{" "}
                  <Link href={href({ display: "list", view: "all", month: "" })} className="font-semibold text-navy underline underline-offset-2">
                    see the list
                  </Link>
                  .
                </p>
              )}
            </div>
          ) : rows.length === 0 ? (
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
                      <td className={`py-2.5 pr-3 font-headline text-[15px] font-bold ${r.grade === "G1" ? "text-accent" : "text-navy"}`}>{r.race}</td>
                      <td className="py-2.5 pr-3 text-[#33363d]">
                        {r.track}
                        <span className="block text-[12px] text-muted">
                          {[r.region !== "NZ" ? r.region : "", showCountry ? COUNTRY_NAMES[r.country] : ""].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[#33363d]">{r.klass || "N/A"}</td>
                      <td className="py-2.5 pr-3 text-[#33363d]">{r.gait}</td>
                      <td className="py-2.5 pr-3">
                        <Grade grade={r.grade} />
                      </td>
                      {showDistance && <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-[#33363d]">{r.distance ? `${r.distance}m` : "—"}</td>}
                      <td className="whitespace-nowrap py-2.5 text-right font-semibold tabular-nums text-ink">{formatStakes(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {display === "list" && pages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[13px] font-bold uppercase tracking-[0.1em]">
              {page > 1 ? (
                <Link href={href({ page: String(page - 1) })} className="text-navy hover:text-blue">
                  ← Earlier
                </Link>
              ) : (
                <span />
              )}
              {page < pages ? (
                <Link href={href({ page: String(page + 1) })} className="text-navy hover:text-blue">
                  Later →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          <p className="mt-5 text-[12.5px] leading-relaxed text-muted">
            Stakes are shown in {meta.currency}. Dates and conditions are set by each racing authority and can change — confirm with the club before travelling.
          </p>
        </div>

        <aside className={display === "list" ? "flex flex-col gap-7 xl:sticky xl:top-4" : ""}>
          <section className="sheet p-5">
            <h2 className="rule-head font-headline text-[19px] font-bold text-navy">Upcoming Group 1 races</h2>
            {groupOnes.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">No Group 1 races remain on this calendar.</p>
            ) : (
              <ol className={`mt-1 ${display === "calendar" ? "grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4 [&>li]:last:border-b [&>li]:last:pb-3" : ""}`}>
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
