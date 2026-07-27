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

  // Scar Struck is the only horse on the book.
  const scarStruck = await prisma.offering.create({
    data: {
      slug: "scar-struck",
      name: "Scar Struck",
      discipline: "Pacer",
      heroColor: "green",
      imageUrl: "/horses/scar-struck.png", // committed in public/horses
      tagline: "Our flagship pacer. Grab a share and get your heart racing.",
      description:
        "Scar Struck is a strong, honest pacer built for the big metropolitan nights. Offered as micro-shares so anyone can own a piece, follow every run, and share in the prizemoney. This is the whole point of BPM Bloodstock: real ownership, no six-figure buy-in.",
      trainer: "TBC",
      sire: "TBC",
      dam: "TBC",
      totalShares: 1000,
      sharePriceCents: 5000, // $50 / share
      sharesSold: 180,
      mgmtFeeBps: 1000, // 10%
      status: "OPEN",
    },
  });

  // Seed a couple of holdings so dashboards + payout demos are non-empty.
  await prisma.shareHolding.create({
    data: { userId: alex.id, offeringId: scarStruck.id, shares: 40 },
  });
  await prisma.shareHolding.create({
    data: { userId: sam.id, offeringId: scarStruck.id, shares: 20 },
  });

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
