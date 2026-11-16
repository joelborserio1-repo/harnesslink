// Race analysis attached to a story (cms/src/race-analysis.ts has the source
// of truth for these shapes). Fields come from the HarnessLink racing API
// (TAB data); picks, comments and speed maps are the analyst's.

export type Entry = {
  no: number;
  barrier: string | null;
  handicap: number | null;
  horse: string;
  driver: string | null;
  trainer: string | null;
  junior: boolean;
  silk: string | null;
  colours: string | null;
  form: string | null;
  comment: string | null;
  win: number | null;
  place: number | null;
  toteWin: number | null;
  scratched: boolean;
  emergency: boolean;
  gearOn: string | null;
  gearOff: string | null;
  placing: string | null;
  margin: string | null;
};

export type Race = {
  id: number;
  no: number;
  name: string;
  distance: number | null;
  start: "mobile" | "standing" | null;
  gait: "trot" | "pace";
  className: string | null;
  stakes: number | null;
  startTime: string | null;
  status: string | null;
  resulted: boolean;
  dividends: string | null;
  mileRate: string | null;
  winTime: string | null;
  entries: Entry[];
};

export type Meeting = {
  id: number;
  date: string;
  venue: string;
  country: string;
  timezone: string;
  trackCondition: string | null;
  races: Race[];
  pulledAt: string;
};

export type SpeedMapLayout = { rail: number[]; outside: number[]; three?: number[] };
export type RaceNotes = { picks: { no: number; comment: string }[]; note?: string; map?: SpeedMapLayout | null };

export type RaceAnalysis = {
  meeting: Meeting;
  notes: Record<string, RaceNotes>;
  bestBet?: { race: number; no: number } | null;
  bestValue?: { race: number; no: number } | null;
};

export type LiveEntry = { win: number | null; place: number | null; toteWin: number | null; scratched: boolean; placing: string | null; margin: string | null };
export type Live = {
  at: string;
  trackCondition: string | null;
  weather?: import("@/components/analysis/TrackGuide").Weather;
  races: Record<string, { status: string | null; resulted: boolean; dividends: string | null; entries: Record<string, LiveEntry> }>;
};

// TAB serves silk images to browsers (not to servers), so readers load them directly.
export const silkUrl = (path: string | null) => (path ? `https://api.beta.tab.com.au${path}` : null);

// Australian and New Zealand harness saddlecloth colours.
const CLOTHS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#d7262e", fg: "#fff" },
  2: { bg: "repeating-linear-gradient(180deg,#111 0 3px,#fff 3px 6px)", fg: "#d7262e" },
  3: { bg: "#fff", fg: "#111" },
  4: { bg: "#1f5fd1", fg: "#fff" },
  5: { bg: "#f6d21b", fg: "#111" },
  6: { bg: "#2f9e44", fg: "#fff" },
  7: { bg: "#111", fg: "#f6d21b" },
  8: { bg: "#e83e8c", fg: "#111" },
  9: { bg: "repeating-linear-gradient(135deg,#2f9e44 0 4px,#fff 4px 8px)", fg: "#111" },
  10: { bg: "linear-gradient(90deg,#1f5fd1 0 33%,#fff 33% 66%,#d7262e 66%)", fg: "#111" },
  11: { bg: "#6b2fa0", fg: "#fff" },
  12: { bg: "#7a1f2b", fg: "#fff" },
  13: { bg: "#7a8088", fg: "#fff" },
  14: { bg: "#0e2455", fg: "#fff" },
};
export const cloth = (no: number) => CLOTHS[no] || { bg: "#4a4e57", fg: "#fff" };

export const money = (n: number | null | undefined) => (n && n > 1 ? `$${n.toFixed(2)}` : "–");

export const ordinal = (p: string | number | null) => {
  const n = Number(p);
  if (!n) return "";
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th";
  return `${n}${s}`;
};

// TAB race names arrive like "Race Images Handicap Pace Ss": drop the start
// code (we say Mobile / Standing ourselves) and fix the usual capitals.
export const raceTitle = (name: string) =>
  name
    .replace(/\s+(Ms|Ss)$/i, "")
    .replace(/\bNz\b/g, "NZ")
    .replace(/\bN\.i\.\b/gi, "N.I.")
    .replace(/\b(\d+)yo\b/gi, "$1YO")
    .replace(/\bAydc\b/g, "AYDC")
    .replace(/\bNzmca\b/g, "NZMCA");

export const startLabel = (r: Race) => (r.start === "mobile" ? "Mobile" : r.start === "standing" ? "Standing start" : null);

export function raceTime(r: Race, tz: string) {
  if (!r.startTime) return null;
  return new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(r.startTime)).replace(" ", "").toLowerCase();
}

// Starters for the speed map: everything not scratched, emergencies last.
export const starters = (r: Race) => r.entries.filter((e) => !e.scratched && !e.emergency);

// Default speed map when the analyst hasn't drawn one: the field in number
// order, front half on the rail and the rest outside. Readers rearrange it.
export function defaultLayout(r: Race): SpeedMapLayout {
  const field = starters(r).map((e) => e.no);
  const half = Math.ceil(field.length / 2);
  return { rail: field.slice(0, half), outside: field.slice(half), three: [] };
}
