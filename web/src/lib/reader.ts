import type { NextResponse } from "next/server";

// Reader sign-in. Strapi issues a 30-day token; the site keeps it in a
// secure, script-proof cookie and swaps it for a fresh one once a day while
// the reader keeps visiting (proxy.ts) — so active readers stay signed in.
// `hl_reader` (readable by the page) only holds their first name, for the
// header and the registration wall.
export const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");
export const SESSION = "hl_session";
export const SESSION_AT = "hl_session_at";
export const READER = "hl_reader";
export const MAX_AGE = 30 * 24 * 60 * 60; // seconds
export const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export type Reader = { email: string; firstName: string; lastName: string; insider: boolean };

const secure = process.env.NODE_ENV === "production";

export function setSession(res: NextResponse, token: string, reader: Pick<Reader, "firstName">) {
  const base = { path: "/", maxAge: MAX_AGE, sameSite: "lax" as const, secure };
  res.cookies.set(SESSION, token, { ...base, httpOnly: true });
  res.cookies.set(SESSION_AT, String(Date.now()), { ...base, httpOnly: true });
  res.cookies.set(READER, encodeURIComponent(reader.firstName || "Reader"), base);
}

export function clearSession(res: NextResponse) {
  for (const name of [SESSION, SESSION_AT, READER]) res.cookies.set(name, "", { path: "/", maxAge: 0 });
}

// Server-to-server call to the CMS's reader routes.
export async function readerApi(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${STRAPI_URL}/api/readers/${path}`, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}
