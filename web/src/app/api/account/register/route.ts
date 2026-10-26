import { NextResponse } from "next/server";
import { readerApi, setSession } from "@/lib/reader";

// POST { firstName, lastName, email, password, insider, source } → creates
// the account and signs them in.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const { status, ok, data } = await readerApi("register", {
    body: {
      firstName: b.firstName,
      lastName: b.lastName,
      email: b.email,
      password: b.password,
      insider: b.insider,
      source: b.source,
      website: b.website,
    },
  });
  const res = NextResponse.json(ok ? { reader: data.reader } : data, { status });
  if (ok) setSession(res, data.token, data.reader);
  return res;
}
