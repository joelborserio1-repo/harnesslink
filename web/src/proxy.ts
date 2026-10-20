import { NextRequest, NextResponse } from "next/server";

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
  return withRobots(NextResponse.next({ request: { headers } }));
}

// Skip Next internals, the API, and anything with a file extension (assets).
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
