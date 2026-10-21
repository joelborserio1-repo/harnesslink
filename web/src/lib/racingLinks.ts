// Links and formatting shared by the racing pages (safe for client components).

export type RacingCountry = "nz" | "au";
export type RacingView = "fields" | "results";

export const COUNTRY: Record<RacingCountry, { code: "NZ" | "AU"; label: string; name: string; tz: string; flag: "nz" | "au" }> = {
  nz: { code: "NZ", label: "NZ", name: "New Zealand", tz: "Pacific/Auckland", flag: "nz" },
  au: { code: "AU", label: "AUS", name: "Australia", tz: "Australia/Sydney", flag: "au" },
};

export const isCountry = (c: string): c is RacingCountry => c === "nz" || c === "au";
export const isView = (v: string): v is RacingView => v === "fields" || v === "results";

export const dayHref = (country: RacingCountry, view: RacingView, date?: string) =>
  `/racing/${country}/${view}/${date ? `?date=${date}` : ""}`;
export const raceHref = (id: number) => `/racing/race/${id}/`;
export const horseHref = (id: number) => `/racing/horse/${id}/`;
export const personHref = (id: number) => `/racing/people/${id}/`;
export const silkSrc = (path: string) => `/api/silk/?p=${encodeURIComponent(path)}`;

/** YYYY-MM-DD for "now" in a time zone. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "7:05pm" in the meeting's own time zone. */
export function raceTime(iso: string | null, tz: string): string {
  if (!iso) return "TBA";
  return new Date(iso)
    .toLocaleTimeString("en-NZ", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .replace(" ", "")
    .toLowerCase();
}

/** "Tue 21 Oct" from a YYYY-MM-DD date (no time-zone shift). */
export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { ...opts, timeZone: "UTC" });
}

export const money = (v: string | number | null | undefined) =>
  v == null || v === "" ? null : `$${Math.round(Number(v)).toLocaleString("en-AU")}`;

/** 145.7 seconds -> "2:25.7" */
export function raceClock(seconds: string | number | null | undefined): string | null {
  if (seconds == null || seconds === "") return null;
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return null;
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, "0");
  return m ? `${m}:${rest}` : rest;
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** HRNZ replays are YouTube embed links; returns the video id. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/** Dividend lines from HRNZ's or TAB's one-line text. HRNZ leaves Win/Place unlabelled
 * ("$10.20. $5.00. $1.80. Quinella $20.40."): the first bare amount is Win, the rest are Place. */
export function dividendLines(text: string): string[] {
  const parts = text.split(/\.\s+|\.$/).map((p) => p.trim()).filter(Boolean);
  const bare = [];
  while (parts.length && /^\$[\d,.]+$/.test(parts[0])) bare.push(parts.shift()!);
  const lead = bare.length ? [`Win ${bare[0]}`, ...(bare.length > 1 ? [`Place ${bare.slice(1).join(", ")}`] : [])] : [];
  return [...lead, ...parts].map((l) => l.replace(/^First4\b/, "First Four").replace(/^FirstFour\b/, "First Four").replace(/^RunningDouble\b/, "Running Double").replace(/^DailyDouble\b/, "Daily Double"));
}
