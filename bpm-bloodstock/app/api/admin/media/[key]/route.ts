import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// Which brand slots can be managed, and their base filename in public/brand.
const KEYS = new Set(["logo", "icon", "promo"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const ALL_EXTS = ["svg", "png", "webp", "jpg", "jpeg"];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Upload / replace a brand image from the admin UI. Saves to
 * public/brand/<key>.<ext> and it is live immediately (public files are served
 * at request time; brand lookups cache-bust by file mtime).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const key = params.key;
  if (!KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown media slot" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Use a PNG, JPG, WEBP or SVG image" },
      { status: 400 }
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image is over 8 MB" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "brand");
  await fs.mkdir(dir, { recursive: true });
  // Clear other extension variants so only one <key> file exists.
  for (const e of ALL_EXTS) {
    await fs.rm(path.join(dir, `${key}.${e}`)).catch(() => {});
  }
  await fs.writeFile(path.join(dir, `${key}.${ext}`), buf);

  return NextResponse.json({ ok: true, path: `/brand/${key}.${ext}` });
}
