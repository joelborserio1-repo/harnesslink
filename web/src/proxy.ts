import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";

// Gate the /admin section with HTTP Basic against ADMIN_USER / ADMIN_PASSWORD.
function adminAuthorized(req: NextRequest): boolean {
  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASSWORD || "";
  if (!user || !pass) return false;
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = atob(header.slice(6));
  const i = decoded.indexOf(":");
  return decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!adminAuthorized(req)) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Harnesslink Admin"' },
      });
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
        return NextResponse.redirect(dest, data.status ?? 301);
      }
    }
  } catch {
    // fail open
  }

  const headers = new Headers(req.headers);
  headers.set("x-invoked-path", pathname);
  return NextResponse.next({ request: { headers } });
}

// Skip Next internals, the API, and anything with a file extension (assets).
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
