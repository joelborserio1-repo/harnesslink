import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Upload a horse photo from the browser. Saves it to public/horses/<slug>.<ext>
 * and points the offering's imageUrl at it (with a cache-busting version), so
 * it shows immediately on the cards, detail page and featured showcase.
 */
export async function POST(
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

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Use a JPG, PNG or WEBP image" },
      { status: 400 }
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image is over 8 MB" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "horses");
  await fs.mkdir(dir, { recursive: true });
  // Remove any prior extension variants so we don't leave stale files behind.
  for (const e of ["jpg", "jpeg", "png", "webp"]) {
    await fs.rm(path.join(dir, `${offering.slug}.${e}`)).catch(() => {});
  }
  await fs.writeFile(path.join(dir, `${offering.slug}.${ext}`), buf);

  const imageUrl = `/horses/${offering.slug}.${ext}?v=${Date.now()}`;
  await prisma.offering.update({
    where: { id: offering.id },
    data: { imageUrl },
  });

  return NextResponse.json({ ok: true, imageUrl });
}
