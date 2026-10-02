// Feature race calendar data + filtering. Replaces the WordPress
// "Harnesslink Feature Race Calendar" plugin (shortcode
// [harnesslink_race_calendar country="AU|NZ|ALL|US|CA|INTL"]).
//
// The rows are Harnesslink's own published calendar data, carried over as
// JSON. Filtering runs on the server from the URL's query string, so every
// filtered view is a plain, shareable, crawlable page and the browser ships
// no calendar JavaScript.
import australia from "@/data/race-calendar/australia.json";
import newZealand from "@/data/race-calendar/new-zealand.json";
import northAmerica from "@/data/race-calendar/north-america.json";

export type CountryCode = "AU" | "NZ" | "US" | "CA";
export type Scope = CountryCode | "INTL";

export type Race = {
  date: string; // ISO yyyy-mm-dd, or "" when the date is to be confirmed
  race: string;
  track: string;
  region: string; // state / province code, or "NZ"
  regionName: string;
  country: CountryCode;
  klass: string;
  age: string;
  sex: string;
  gait: string;
  grade: string;
  stakes: number | null;
  stakeNote: string;
  distance: string;
  rescheduled: boolean;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function normalise(raw: Raw, fallback: CountryCode): Race {
  const country = (str(raw.country) as CountryCode) || fallback;
  const state = str(raw.state);
  return {
    date: str(raw.date),
    race: str(raw.race),
    track: str(raw.track),
    region: country === "NZ" ? "NZ" : state,
    regionName: str(raw.regionName) || state,
    country,
    klass: str(raw.class),
    age: str(raw.age),
    sex: str(raw.sex),
    gait: str(raw.gait),
    grade: str(raw.grade) || str(raw.status),
    stakes: typeof raw.stakes === "number" && raw.stakes > 0 ? raw.stakes : null,
    stakeNote: str(raw.stakeNote),
    distance: str(raw.distance),
    rescheduled: raw.rescheduled === true,
  };
}

const ALL: Race[] = [
  ...(australia as Raw[]).map((r) => normalise(r, "AU")),
  ...(newZealand as Raw[]).map((r) => normalise(r, "NZ")),
  ...(northAmerica as Raw[]).map((r) => normalise(r, "US")),
].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.race.localeCompare(b.race));

export const SCOPES: { scope: Scope; label: string; title: string; path: string; currency: string }[] = [
  { scope: "INTL", label: "International", title: "International Race Calendar", path: "/international-race-calendar/", currency: "local currency" },
  { scope: "AU", label: "Australia", title: "Australia Feature Race Calendar", path: "/feature-race-calendar-au/", currency: "Australian dollars" },
  { scope: "NZ", label: "New Zealand", title: "New Zealand Feature Race Calendar", path: "/feature-race-calendar-nz/", currency: "New Zealand dollars" },
  { scope: "US", label: "United States", title: "United States Race Calendar", path: "/united-states-race-calendar/", currency: "US dollars" },
  { scope: "CA", label: "Canada", title: "Canada Race Calendar", path: "/canada-race-calendar/", currency: "Canadian dollars" },
];

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  US: "United States",
  CA: "Canada",
};

export type Filters = {
  view: "upcoming" | "all";
  country: string;
  region: string;
  gait: string;
  grade: string;
  month: string; // yyyy-mm
  q: string;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  return {
    view: one("view") === "all" ? "all" : "upcoming",
    country: one("country"),
    region: one("region"),
    gait: one("gait"),
    grade: one("grade"),
    month: one("month"),
    q: one("q").slice(0, 80),
  };
}

export function racesFor(scope: Scope): Race[] {
  return scope === "INTL" ? ALL : ALL.filter((r) => r.country === scope);
}

// Today in the site's own timezone, as yyyy-mm-dd, so "upcoming" flips at
// midnight for the newsroom rather than at UTC midnight.
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
}

export function applyFilters(rows: Race[], f: Filters, now: string): Race[] {
  const q = f.q.toLowerCase();
  return rows.filter((r) => {
    if (f.view === "upcoming" && r.date && r.date < now) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.region && r.region !== f.region) return false;
    if (f.gait && r.gait !== f.gait) return false;
    if (f.grade && r.grade !== f.grade) return false;
    if (f.month && !r.date.startsWith(f.month)) return false;
    if (q && !`${r.race} ${r.track} ${r.klass}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

const GRADE_ORDER = ["G1", "G2", "G3", "Listed", "R1", "R2", "R3", "SSH", "Semi", "Prelude", "Feature", "NG"];

export function options(rows: Race[]) {
  const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))];
  return {
    countries: uniq(rows.map((r) => r.country)) as CountryCode[],
    regions: uniq(rows.map((r) => r.region)).sort(),
    gaits: uniq(rows.map((r) => r.gait)).sort(),
    grades: uniq(rows.map((r) => r.grade)).sort(
      (a, b) => (GRADE_ORDER.indexOf(a) + 1 || 99) - (GRADE_ORDER.indexOf(b) + 1 || 99)
    ),
    months: uniq(rows.map((r) => r.date.slice(0, 7))).sort(),
  };
}

export function formatRaceDate(iso: string): string {
  if (!iso) return "TBC";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatStakes(r: Race): string {
  if (r.stakes === null) return r.stakeNote || "—";
  return `$${Math.round(r.stakes).toLocaleString("en-AU")}`;
}
