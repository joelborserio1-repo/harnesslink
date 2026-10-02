import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";

// The /admin section needs a staff session cookie. This is only the outer
// gate (is there a session at all?) — the Rails API verifies the token and
// enforces roles on every request.
const SESSION_COOKIE = "hl_staff";

// Staging must never be indexed: it serves the same stories as production.
// Set NOINDEX=true in the staging .env; leave it unset in production. Read at
// runtime, so the same image serves both.
function withRobots(res: NextResponse): NextResponse {
  if (process.env.NOINDEX === "true") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const onLogin = pathname.startsWith("/admin/login");
    if (!onLogin && !req.cookies.get(SESSION_COOKIE)?.value) {
      return NextResponse.redirect(new URL("/admin/login/", req.url));
    }
    const headers = new Headers(req.headers);
    headers.set("x-invoked-path", pathname);
    return NextResponse.next({ request: { headers } });
  }

  // Public site: enforce legacy → new 301s from the Rails Redirect table.
  // Fails open: if the API is unreachable, the request proceeds.
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/redirects/resolve?path=${encodeURIComponent(pathname)}`,
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
