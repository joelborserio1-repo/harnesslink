import { NextRequest, NextResponse } from "next/server";
import { RENEW_AFTER_MS, SESSION, SESSION_AT, WP_LOGIN_COOKIE, WP_TRIED, clearSession, readerApi, setSession } from "@/lib/reader";

const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");

// Staging must never be indexed: it serves the same stories as production.
// Set NOINDEX=true in the staging .env; leave it unset in production. Read at
// runtime, so the same image serves both.
function withRobots(res: NextResponse): NextResponse {
  if (process.env.NOINDEX === "true") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Enforce legacy → new 301s from the CMS's Redirect collection.
  // Fails open: if the API is unreachable, the request proceeds.
  try {
    const res = await fetch(
      `${STRAPI_URL}/api/redirects/resolve?path=${encodeURIComponent(pathname)}`,
      { cache: "no-store", signal: AbortSignal.timeout(1500) }
    );
    if (res.ok) {
      const data = (await res.json()) as { redirect: boolean; status?: number; location?: string };
      if (data.redirect && data.location) {
        const dest = data.location.startsWith("http")
          ? data.location
          : new URL(data.location, req.url).toString();
        return withRobots(NextResponse.redirect(dest, data.status ?? 301));
      }
    }
  } catch {
    // fail open
  }

  const headers = new Headers(req.headers);
  headers.set("x-invoked-path", pathname);
  const wp = await fromWordPress(req);
  if (wp?.signedIn) {
    // Load the same page again so it renders signed in.
    const again = withRobots(NextResponse.redirect(req.url, 307));
    wp.apply(again);
    return again;
  }
  const renewal = (await renewSession(req)) || wp?.apply || null;
  // Reader's country for ad targeting: Cloudflare's CF-IPCountry, or
  // ?geo=NZ to preview what a reader in another country sees.
  const geo = req.nextUrl.searchParams.get("geo") || req.headers.get("cf-ipcountry") || "";
  headers.set("x-hl-country", /^[A-Za-z]{2}$/.test(geo) ? geo.toUpperCase() : "");
  // ?geo= previews show ads but don't count towards advertisers' reports.
  if (req.nextUrl.searchParams.get("geo")) headers.set("x-hl-geo-preview", "1");
  else headers.delete("x-hl-geo-preview");
  const res = withRobots(NextResponse.next({ request: { headers } }));
  renewal?.(res);
  return res;
}

// Signed-in readers get a fresh one-year session once a day while they keep
// visiting, so regular readers are never signed out. Returns a function that
// writes the new cookies onto the response (or clears a dead session).
async function renewSession(req: NextRequest): Promise<((res: NextResponse) => void) | null> {
  const token = req.cookies.get(SESSION)?.value;
  if (!token) return null;
  const at = Number(req.cookies.get(SESSION_AT)?.value || 0);
  if (Date.now() - at < RENEW_AFTER_MS) return null;
  try {
    const { status, ok, data } = await readerApi("refresh", { method: "POST", token });
    if (ok) return (res) => setSession(res, data.token, data.reader);
    if (status === 401) return (res) => clearSession(res);
  } catch {
    // CMS unreachable: keep the current session and try again next visit
  }
  return null;
}

// A visitor with no session here who is still logged in to the old WordPress
// site (same domain after cutover) is signed in to their imported account.
// Tried once a day at most; the CMS checks the cookie's signature.
async function fromWordPress(req: NextRequest): Promise<{ signedIn: boolean; apply: (res: NextResponse) => void } | null> {
  if (req.cookies.get(SESSION)?.value || req.cookies.get(WP_TRIED)?.value) return null;
  const wp = req.cookies.getAll().find((c) => WP_LOGIN_COOKIE.test(c.name));
  if (!wp?.value) return null;
  try {
    const { ok, data } = await readerApi("wp-session", { method: "POST", body: { cookie: wp.value }, site: true });
    if (ok && data?.token) return { signedIn: true, apply: (res) => setSession(res, data.token, data.reader) };
  } catch {
    // CMS unreachable: try again on a later visit
    return null;
  }
  return {
    signedIn: false,
    apply: (res) => {
      res.cookies.set(WP_TRIED, "1", { path: "/", maxAge: 24 * 60 * 60, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
    },
  };
}

// Skip Next internals, the API, and anything with a file extension (assets).
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
