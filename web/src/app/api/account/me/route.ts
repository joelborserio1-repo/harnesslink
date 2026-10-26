import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { READER, SESSION, clearSession, readerApi } from "@/lib/reader";

// PUT { firstName, lastName, insider } → updates the signed-in reader.
export async function PUT(req: Request) {
  const token = (await cookies()).get(SESSION)?.value;
  if (!token) return NextResponse.json({ error: { message: "Please sign in again." } }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const { status, ok, data } = await readerApi("me", {
    method: "PUT",
    token,
    body: { firstName: b.firstName, lastName: b.lastName, insider: b.insider },
  });
  const res = NextResponse.json(data, { status });
  if (status === 401) clearSession(res);
  else if (ok) res.cookies.set(READER, encodeURIComponent(data.reader.firstName || "Reader"), { path: "/", maxAge: 30 * 24 * 60 * 60, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
