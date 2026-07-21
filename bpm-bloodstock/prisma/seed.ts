import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding BPM Bloodstock…");

  // Wipe (dev only) so the seed is idempotent.
  await prisma.prizeDistribution.deleteMany();
  await prisma.prizeEvent.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shareHolding.deleteMany();
  await prisma.offering.deleteMany();
  await prisma.user.deleteMany();

  const pw = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@bpmbloodstock.com",
      name: "BPM Admin",
      passwordHash: pw,
      isAdmin: true,
      walletBalanceCents: 0,
    },
  });

  const alex = await prisma.user.create({
    data: {
      email: "alex@example.com",
      name: "Alex Rider",
      passwordHash: pw,
      walletBalanceCents: 50000, // $500 starting balance to play with
    },
  });

  const sam = await prisma.user.create({
    data: {
      email: "sam@example.com",
      name: "Sam Carter",
      passwordHash: pw,
      walletBalanceCents: 25000,
    },
  });

  const offerings = await Promise.all([
    prisma.offering.create({
      data: {
        slug: "menangle-magic",
        name: "Menangle Magic",
        discipline: "Pacer",
        heroColor: "gold",
        tagline: "A robust 3yo pacer with a searing turn of foot.",
        description:
          "By a proven speed sire out of a stakes-placed mare, Menangle Magic has trialled strongly and is set for a metropolitan campaign. Trained on the famed Menangle track, this colt is built for the big nights.",
        trainer: "K. McCarthy",
        sire: "Captaintreacherous",
        dam: "Sundons Gift",
        totalShares: 1000,
        sharePriceCents: 5000, // $50 / share
        sharesSold: 240,
        mgmtFeeBps: 1000, // 10%
        status: "OPEN",
      },
    }),
    prisma.offering.create({
      data: {
        slug: "southern-rhythm",
        name: "Southern Rhythm",
        discipline: "Trotter",
        heroColor: "green",
        tagline: "Squaregaiter with a huge motor and a calm head.",
        description:
          "A beautifully bred trotter showing genuine staying ability. Consistent, tough and honest — the kind of horse that racks up prizemoney across a long preparation.",
        trainer: "A. Turnbull",
        sire: "Muscle Hill",
        dam: "Grace Kelly",
        totalShares: 800,
        sharePriceCents: 7500, // $75 / share
        sharesSold: 800,
        mgmtFeeBps: 1000,
        status: "CLOSED",
      },
    }),
    prisma.offering.create({
      data: {
        slug: "heart-of-gold",
        name: "Heart of Gold",
        discipline: "Pacer",
        heroColor: "gold",
        tagline: "Low entry point — own a slice of a metro pacer for $40.",
        description:
          "Micro-shares make ownership accessible: Heart of Gold is a well-related 2yo pacer bought at the sales and offered in small parcels so anyone can experience the thrill of a Saturday night runner at Menangle or Melton.",
        trainer: "C. Alford",
        sire: "American Ideal",
        dam: "Golden Miss",
        totalShares: 2000,
        sharePriceCents: 4000, // $40 / share
        sharesSold: 610,
        mgmtFeeBps: 1200, // 12%
        status: "OPEN",
      },
    }),
  ]);

  const [menangle, southern] = offerings;

  // Give the demo investors some holdings so dashboards + payouts are non-empty.
  // Alex: 40 shares of Menangle, 30 of Southern Rhythm.
  // Sam: 10 shares of Menangle, 20 of Southern Rhythm.
  async function seedHolding(userId: string, offeringId: string, shares: number) {
    await prisma.shareHolding.create({ data: { userId, offeringId, shares } });
  }
  await seedHolding(alex.id, menangle.id, 40);
  await seedHolding(alex.id, southern.id, 30);
  await seedHolding(sam.id, menangle.id, 10);
  await seedHolding(sam.id, southern.id, 20);

  console.log("Seed complete.");
  console.log("---------------------------------------------");
  console.log("Admin login:    admin@bpmbloodstock.com / password123");
  console.log("Investor login: alex@example.com        / password123");
  console.log("Investor login: sam@example.com         / password123");
  console.log("---------------------------------------------");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
