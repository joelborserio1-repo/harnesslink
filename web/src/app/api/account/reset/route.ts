import { NextResponse } from "next/server";
import { readerApi, setSession } from "@/lib/reader";

// POST { code, password } → sets the new password and signs them in.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const { status, ok, data } = await readerApi("reset-password", { body: { code: b.code, password: b.password } });
  const res = NextResponse.json(ok ? { reader: data.reader } : data, { status });
  if (ok) setSession(res, data.token, data.reader);
  return res;
}
