import { NextResponse } from "next/server";
import { readerApi } from "@/lib/reader";

// POST { email } → emails a set-password link if there's an account.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  await readerApi("forgot-password", { body: { email: b.email } });
  return NextResponse.json({ ok: true });
}
