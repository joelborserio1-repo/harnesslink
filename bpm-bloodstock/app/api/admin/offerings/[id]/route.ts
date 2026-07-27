import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    trainer: z.string().optional(),
    sire: z.string().optional(),
    dam: z.string().optional(),
    heroColor: z.enum(["gold", "green"]).optional(),
    sharePriceCents: z.number().int().positive().optional(),
    totalShares: z.number().int().positive().optional(),
    mgmtFeeBps: z.number().int().min(0).max(5000).optional(),
    status: z.enum(["OPEN", "CLOSED", "RETIRED"]).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const offering = await prisma.offering.findUnique({ where: { id: params.id } });
  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }

  try {
    const data = patchSchema.parse(await req.json());
    // Never let total shares drop below what's already been sold.
    if (data.totalShares !== undefined && data.totalShares < offering.sharesSold) {
      return NextResponse.json(
        { error: `Total shares can't be below the ${offering.sharesSold} already sold` },
        { status: 400 }
      );
    }
    const updated = await prisma.offering.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ ok: true, slug: updated.slug });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e?.message ?? "Could not update" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const offering = await prisma.offering.findUnique({ where: { id: params.id } });
  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }
  // Holdings, orders and prize events cascade-delete with the offering.
  await prisma.offering.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
