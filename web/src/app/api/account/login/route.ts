import { NextResponse } from "next/server";
import { readerApi, setSession } from "@/lib/reader";

// POST { email, password } → signs the reader in on this browser.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { status, ok, data } = await readerApi("login", { body: { email: body.email, password: body.password } });
  const res = NextResponse.json(ok ? { reader: data.reader } : data, { status });
  if (ok) setSession(res, data.token, data.reader);
  return res;
}
