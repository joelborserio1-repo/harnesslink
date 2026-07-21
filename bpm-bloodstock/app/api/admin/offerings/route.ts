import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  discipline: z.enum(["Pacer", "Trotter"]),
  tagline: z.string().default(""),
  description: z.string().default(""),
  trainer: z.string().default(""),
  sire: z.string().default(""),
  dam: z.string().default(""),
  heroColor: z.enum(["gold", "green"]).default("gold"),
  totalShares: z.number().int().positive(),
  sharePriceCents: z.number().int().positive(),
  mgmtFeeBps: z.number().int().min(0).max(5000).default(1000),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const data = schema.parse(await req.json());
    let slug = slugify(data.name);
    // ensure unique slug
    if (await prisma.offering.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }
    const offering = await prisma.offering.create({
      data: { ...data, slug, status: "OPEN", sharesSold: 0 },
    });
    return NextResponse.json({ ok: true, slug: offering.slug });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e?.message ?? "Could not create offering" },
      { status: 400 }
    );
  }
}
