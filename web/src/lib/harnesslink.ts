// Server-side client for the HarnessLink racing API (TAB + HRNZ, merged).
// Runs in React Server Components and route handlers only: the service key
// (HARNESSLINK_API_KEY, hls_...) never reaches the browser.
import "server-only";

const BASE = (process.env.HARNESSLINK_API_URL || "https://admin.harnesslink.com/api").replace(/\/$/, "");
const KEY = process.env.HARNESSLINK_API_KEY || "";
const REVALIDATE = 60; // HarnessLink refreshes TAB every 30 min; a minute is plenty
const BOARD_SIZE = 6;

type Price = { market_type: string; price: string | number };
type Entry = {
  saddlecloth: number | null;
  horse_name: string;
  scratched: boolean;
  position: number | null;
  latest_prices: Price[];
  colours_image: string | null;
};
type RaceSummary = { id: number; race_number: number; distance_m: number | null; start_time: string | null; status: string };
type Meeting = { id: number; venue: string; country: string; races: RaceSummary[] };
type RaceDetail = RaceSummary & { entries: Entry[] };

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

async function get<T>(path: string): Promise<T | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // the widget hides itself rather than breaking the page
  }
}

function winPrice(e: Entry): number | null {
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
