import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { purchaseShares, WalletError } from "@/lib/wallet";

const schema = z.object({ shares: z.number().int().positive() });

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const offering = await prisma.offering.findUnique({
    where: { slug: params.slug },
  });
  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }

  try {
    const { shares } = schema.parse(await req.json());
    const order = await purchaseShares({
      userId: user.id,
      offeringId: offering.id,
      shares,
    });
    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (e: any) {
    const msg =
      e instanceof WalletError ? e.message : e?.message ?? "Purchase failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
