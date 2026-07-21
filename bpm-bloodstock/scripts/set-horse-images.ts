/**
 * Attaches horse photos to offerings from files in public/horses/.
 *
 * Usage (on the server, from the bpm-bloodstock dir):
 *   1. Put image files in public/horses/ named by the horse's slug, e.g.
 *        public/horses/menangle-magic.jpg
 *        public/horses/southern-rhythm.jpg
 *        public/horses/heart-of-gold.jpg
 *      (jpg, jpeg, png or webp all fine.)
 *   2. Run:  npx tsx scripts/set-horse-images.ts
 *   3. Reload:  pm2 reload bpm
 *
 * For each offering it looks for public/horses/<slug>.<ext> and sets imageUrl
 * to /horses/<file>. Horses without a matching file are left untouched.
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const EXTS = ["jpg", "jpeg", "png", "webp"];
const DIR = path.join(process.cwd(), "public", "horses");

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`No public/horses/ directory found at ${DIR}`);
    process.exit(1);
  }

  const offerings = await prisma.offering.findMany();
  let updated = 0;

  for (const o of offerings) {
    const match = EXTS.map((e) => `${o.slug}.${e}`).find((f) =>
      fs.existsSync(path.join(DIR, f))
    );
    if (!match) {
      console.log(`- ${o.name} (${o.slug}): no image file, skipped`);
      continue;
    }
    const url = `/horses/${match}`;
    if (o.imageUrl === url) {
      console.log(`= ${o.name}: already set to ${url}`);
      continue;
    }
    await prisma.offering.update({
      where: { id: o.id },
      data: { imageUrl: url },
    });
    console.log(`+ ${o.name}: imageUrl -> ${url}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} horse${updated === 1 ? "" : "s"}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
