import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { withdraw, WalletError } from "@/lib/wallet";

const schema = z.object({
  amountCents: z.number().int().positive(),
});

/**
 * Withdraw from the wallet. In this scaffold the bank payout itself is stubbed
 * (the ledger debit is real). In production this is where you would create a
 * Stripe Connect Transfer / Payout to the user's connected account.
 */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const { amountCents } = schema.parse(await req.json());
    const balance = await withdraw({ userId: user.id, amountCents });
    return NextResponse.json({ ok: true, balanceCents: balance });
  } catch (e: any) {
    const msg =
      e instanceof WalletError ? e.message : e?.message ?? "Withdrawal failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
