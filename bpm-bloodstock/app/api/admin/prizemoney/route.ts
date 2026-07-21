import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { distributePrizeEvent, WalletError } from "@/lib/wallet";

const schema = z.object({
  offeringId: z.string().min(1),
  raceName: z.string().min(1),
  grossCents: z.number().int().positive(),
  raceDate: z.string().optional(),
});

/**
 * Record a prizemoney result for a horse and distribute it pro-rata to every
 * shareholder's wallet in one atomic transaction.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const data = schema.parse(await req.json());
    const { event, result } = await distributePrizeEvent({
      offeringId: data.offeringId,
      raceName: data.raceName,
      grossCents: data.grossCents,
      raceDate: data.raceDate ? new Date(data.raceDate) : undefined,
    });
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      feeCents: result.feeCents,
      retainedCents: result.retainedCents,
      distributedCents: result.distributedCents,
      recipients: result.payouts.length,
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const msg =
      e instanceof WalletError ? e.message : e?.message ?? "Distribution failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
