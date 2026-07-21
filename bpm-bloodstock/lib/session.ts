import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "bpm_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  return process.env.SESSION_SECRET || "insecure-dev-secret-change-me";
}

function sign(value: string) {
  const sig = crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
  return `${value}.${sig}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

// Cookies are `secure` in production so they only travel over HTTPS. Set
// ALLOW_INSECURE_COOKIES=1 to disable that - ONLY for testing over plain http://
// (e.g. hitting the server's IP:port directly before a domain + TLS are set up).
function cookieSecure() {
  if (process.env.ALLOW_INSECURE_COOKIES === "1") return false;
  return process.env.NODE_ENV === "production";
}

/** Set the signed session cookie for a user id. */
export function setSession(userId: string) {
  cookies().set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

/** Returns the authenticated user id, or null. */
export function getSessionUserId(): string | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  return verify(raw);
}
