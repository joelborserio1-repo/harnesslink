import Link from "next/link";
import { headers } from "next/headers";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";

// Log the genuine miss so real 404s can be fixed from real traffic (the path is
// set on the request by middleware.ts). Fire-and-forget; never block the page.
async function logMiss() {
  try {
    const h = await headers();
    const path = h.get("x-invoked-path");
    if (!path) return;
    await fetch(`${API_BASE}/api/v1/missed_paths`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referer: h.get("referer") }),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // swallow — logging must never break the 404 page
  }
}

export default async function NotFound() {
  await logMiss();

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-accent">404</p>
      <h1 className="font-headline mt-2 text-4xl font-extrabold text-navy-deep">Page not found</h1>
      <p className="mt-3 text-neutral-600">
        We couldn&apos;t find that page. It may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded bg-accent px-5 py-2 font-semibold text-white hover:brightness-110"
      >
        Back to the homepage
      </Link>
    </div>
  );
}
