// The live site runs on New Zealand time (WordPress `timezone_string`), and the
// dates it prints are part of what we must match — so render in that zone
// regardless of where the server or the reader is.
const SITE_TZ = "Pacific/Auckland";

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SITE_TZ,
  });
}

// Card style, matching the live cards: "2 October 2026" (uppercased in the UI).
export function formatCardDate(iso: string | null): string {
  return formatDate(iso);
}

// "6:33 pm" — the article byline carries the time as well as the date.
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: SITE_TZ })
    .toLowerCase();
}

// Short stamp for the wire list: "11:09 am" today-style, with the day.
export function formatWire(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: SITE_TZ });
  return `${day} · ${formatTime(iso)}`;
}
