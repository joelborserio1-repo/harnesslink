import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";

// Runs at the edge before routing. Enforces legacy → new 301s from the Rails
// Redirect table, and tags the request with its path so the 404 page can log
// genuine misses. Fails open: if the API is unreachable, the request proceeds.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
        return NextResponse.redirect(dest, data.status ?? 301);
      }
    }
  } catch {
    // fail open — never block a page on the redirect lookup
  }

  const headers = new Headers(req.headers);
  headers.set("x-invoked-path", pathname);
  return NextResponse.next({ request: { headers } });
}

// Skip Next internals, the API, and anything with a file extension (assets).
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
