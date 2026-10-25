// Server-side client for the HarnessLink racing API (TAB + HRNZ, merged).
// Runs in React Server Components and route handlers only: the service key
// (HARNESSLINK_API_KEY, hls_...) never reaches the browser.
import "server-only";

const BASE = (process.env.HARNESSLINK_API_URL || "https://admin.harnesslink.com/api").replace(/\/$/, "");
const KEY = process.env.HARNESSLINK_API_KEY || "";
const REVALIDATE = 60; // HarnessLink refreshes TAB every 30 min; a minute is plenty
const BOARD_SIZE = 6;

export type Price = { market_type: string; price: string | number; opening_price?: string | number | null; change_pct?: string | number | null };
export type Entry = {
  saddlecloth: number | null;
  barrier: string | null;
  horse_id: number;
  horse_name: string;
  driver_id: number | null;
  driver_name: string | null;
  trainer_id: number | null;
  trainer_name: string | null;
  driver_is_junior: boolean | null;
  handicap_m: number | null;
  emergency: number | null;
  scratched: boolean;
  latest_prices: Price[];
  colours: string | null;
  colours_image: string | null;
  form: string | null;
  form_comment: string | null;
  rating: string | null;
  placing: string | null;
  position: number | null;
  margin_lengths: string | number | null;
  horse_time: string | number | null;
  mile_rate: string | number | null;
  stakes_won: string | number | null;
  review_comment: string | null;
};
export type RaceSummary = {
  id: number;
  race_number: number;
  name: string | null;
  distance_m: number | null;
  start_time: string | null;
  status: string;
  gait: string | null;
  start_type: string | null;
  class_short: string | null;
  stakes_total: string | number | null;
  group_level: number | null;
  starters: number | null;
};
export type MeetingSummary = {
  id: number;
  meeting_date: string;
  venue: string;
  country: string;
  timezone: string;
  race_count: number;
  resulted_count: number;
  next_race_at: string | null;
  track_condition: string | null;
  sources: string[];
};
export type Meeting = { id: number; meeting_date: string; venue: string; country: string; timezone: string; club_name: string | null; races: RaceSummary[] };
export type RaceDetail = RaceSummary & {
  meeting_id: number;
  venue: string | null;
  meeting_date: string | null;
  timezone: string | null;
  track_condition: string | null;
  major_race_name: string | null;
  conditions: string | null;
  win_time: string | number | null;
  mile_rate: string | number | null;
  last_800: string | number | null;
  last_400: string | number | null;
  dividends_text: string | null;
  video_url: string | null;
  sources: string[];
  entries: Entry[];
};
export type Record = { starts: number; wins: number; seconds: number; thirds: number; stakes: string | number; win_pct: number | null; place_pct: number | null };
export type RunLine = {
  race_id: number;
  meeting_date: string;
  venue: string;
  race_number: number;
  race_name: string | null;
  class_short: string | null;
  distance_m: number | null;
  gait: string | null;
  saddlecloth: number | null;
  barrier: string | null;
  horse_id: number;
  horse_name: string;
  driver_id: number | null;
  driver_name: string | null;
  trainer_id: number | null;
  trainer_name: string | null;
  scratched: boolean;
  placing: string | null;
  position: number | null;
  margin_lengths: string | number | null;
  mile_rate: string | number | null;
  stakes_won: string | number | null;
  review_comment: string | null;
  colours_image: string | null;
  major_race_name: string | null;
};
export type CareerLine = { season: number | null; description: string | null; starts: number; firsts: number; seconds: number; thirds: number; stakes: string | number | null };
export type HorseProfile = {
  id: number;
  name: string;
  country: string | null;
  sex: string | null;
  colour: string | null;
  sire: string | null;
  dam: string | null;
  foal_date: string | null;
  foal_season: number | null;
  owner: string | null;
  breeder: string | null;
  trainer_id: number | null;
  trainer_name: string | null;
  gait: string | null;
  rating: string | null;
  colours: string | null;
  colours_image: string | null;
  form_recent: string | null;
  best_mile_rate: string | number | null;
  group1_wins: number;
  record: Record;
  career: { lifetime: CareerLine[] };
  runs: RunLine[];
};
export type PersonProfile = { id: number; name: string; racebook_name: string; locality: string | null; as_driver: Record; as_trainer: Record; runs: RunLine[] };

export type Runner = { number: number | null; horse: string; price: string | null; silk: string | null };

export type BoardRace = {
  id: number;
  venue: string;
  country: string;
  number: number;
  distance: string | null;
  startTime: string | null;
  runner: Runner | null; // favourite for races to come, winner for results
};

export type RaceBoard = { next: BoardRace[]; results: BoardRace[]; generatedAt: string };

export const configured = () => Boolean(KEY);

// "Addington Raceway" -> "Addington": the rail is 300px wide.
const shortVenue = (v: string) => v.replace(/\s+(Raceway|Racecourse|Paceway|Harness Racing Club|Trotting Club|Park Raceway)$/i, "").trim();

async function get<T>(path: string, revalidate = REVALIDATE): Promise<T | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // the widget hides itself rather than breaking the page
  }
}

function winPrice(e: Pick<Entry, "latest_prices">): number | null {
  const p = e.latest_prices.find((x) => x.market_type === "win") ?? e.latest_prices.find((x) => x.market_type === "tote_win");
  const n = p ? Number(p.price) : NaN;
  return Number.isFinite(n) && n > 1.01 ? n : null; // 1.01 is TAB's placeholder price
}

function runner(e: Entry | undefined): Runner | null {
  if (!e) return null;
  const p = winPrice(e);
  return { number: e.saddlecloth, horse: e.horse_name, price: p ? `$${p.toFixed(2)}` : null, silk: e.colours_image };
}

const favourite = (r: RaceDetail) =>
  r.entries.filter((e) => !e.scratched && winPrice(e) !== null).sort((a, b) => winPrice(a)! - winPrice(b)!)[0];

const winner = (r: RaceDetail) => r.entries.find((e) => e.position === 1);

/** Today's next six races and latest six results across AU and NZ harness meetings. */
export async function getRaceBoard(): Promise<RaceBoard | null> {
  const meetings = await get<{ id: number }[]>("/v1/racing/meetings?when=today&limit=20");
  if (!meetings?.length) return null;
  const cards = (await Promise.all(meetings.map((m) => get<Meeting>(`/v1/racing/meetings/${m.id}`)))).filter(
    (m): m is Meeting => m !== null,
  );

  const now = Date.now();
  const all = cards.flatMap((m) => m.races.map((r) => ({ ...r, venue: shortVenue(m.venue), country: m.country })));
  const resulted = (s: string) => s.startsWith("result");
  const time = (r: { start_time: string | null }) => (r.start_time ? Date.parse(r.start_time) : 0);

  const next = all
    .filter((r) => !resulted(r.status) && r.start_time && time(r) > now - 5 * 60_000)
    .sort((a, b) => time(a) - time(b))
    .slice(0, BOARD_SIZE);
  const results = all
    .filter((r) => resulted(r.status))
    .sort((a, b) => time(b) - time(a))
    .slice(0, BOARD_SIZE);

  const detail = async (r: (typeof all)[number], pick: (d: RaceDetail) => Entry | undefined): Promise<BoardRace> => {
    const d = await get<RaceDetail>(`/v1/racing/races/${r.id}`);
    return {
      id: r.id,
      venue: r.venue,
      country: r.country,
      number: r.race_number,
      distance: r.distance_m ? `${r.distance_m}m` : null,
      startTime: r.start_time,
      runner: d ? runner(pick(d)) : null,
    };
  };

  const [n, res] = await Promise.all([
    Promise.all(next.map((r) => detail(r, favourite))),
    Promise.all(results.map((r) => detail(r, winner))),
  ]);
  return { next: n, results: res, generatedAt: new Date(now).toISOString() };
}

// ---------- racing pages (stored data only: these never trigger HRNZ or TAB requests) ----------

/** Every date we hold meetings for in a country, newest first. */
export async function getRacingDays(country: "NZ" | "AU"): Promise<{ date: string; meetings: number }[]> {
  const rows = await get<MeetingSummary[]>(`/v1/racing/meetings?country=${country}&limit=300`, 300);
  const days = new Map<string, number>();
  for (const m of rows ?? []) days.set(m.meeting_date, (days.get(m.meeting_date) ?? 0) + 1);
  return [...days].map(([date, meetings]) => ({ date, meetings })).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getMeetingsOn(country: "NZ" | "AU", date: string): Promise<Meeting[]> {
  const list = await get<MeetingSummary[]>(`/v1/racing/meetings?country=${country}&on=${date}`);
  const full = await Promise.all((list ?? []).map((m) => get<Meeting>(`/v1/racing/meetings/${m.id}`)));
  return full
    .filter((m): m is Meeting => m !== null)
    .map((m) => ({ ...m, venue: shortVenue(m.venue), races: [...m.races].sort((a, b) => a.race_number - b.race_number) }))
    .sort((a, b) => (a.races[0]?.start_time ?? "").localeCompare(b.races[0]?.start_time ?? ""));
}

export const getMeeting = (id: number) => get<Meeting>(`/v1/racing/meetings/${id}`);

export async function getRace(id: number, settled = false): Promise<RaceDetail | null> {
  const r = await get<RaceDetail>(`/v1/racing/races/${id}`, settled ? 600 : REVALIDATE);
  return r && { ...r, venue: r.venue ? shortVenue(r.venue) : r.venue };
}

/** Race details for many races, a few at a time. */
export async function getRaces(ids: number[], settled = false): Promise<Map<number, RaceDetail>> {
  const out = new Map<number, RaceDetail>();
  for (let i = 0; i < ids.length; i += 8) {
    const batch = await Promise.all(ids.slice(i, i + 8).map((id) => getRace(id, settled)));
    batch.forEach((r) => r && out.set(r.id, r));
  }
  return out;
}

const shortRuns = <T extends { runs: RunLine[] }>(p: T | null): T | null => p && { ...p, runs: p.runs.map((r) => ({ ...r, venue: shortVenue(r.venue) })) };
export const getHorse = async (id: number) => shortRuns(await get<HorseProfile>(`/v1/racing/horses/${id}`, 300));
export const getPerson = async (id: number) => shortRuns(await get<PersonProfile>(`/v1/racing/people/${id}`, 300));

export { winPrice, shortVenue };

/** Fetch a racing-colours image for the /api/silk/ proxy. */
export async function getSilk(path: string): Promise<Response | null> {
  if (!KEY || !/^[A-Za-z0-9/_.%-]+$/.test(path) || path.includes("..")) return null;
  try {
    const res = await fetch(`${BASE}/v1/silks/${path}`, {
      headers: { Authorization: `Bearer ${KEY}` },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}
