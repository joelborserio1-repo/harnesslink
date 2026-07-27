/**
 * Integration tests for the money flows, run against a throwaway SQLite DB.
 *   npm run test:flows
 * Covers: checkout allocation + idempotency, oversell guard, pro-rata
 * prizemoney distribution end-to-end, and withdrawal guards / ledger integrity.
 */
import { PrismaClient } from "@prisma/client";
import {
  allocateSharesFromPayment,
  distributePrizeEvent,
  withdraw,
} from "../lib/wallet";

const prisma = new PrismaClient();
let passed = 0;

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
  console.log("  ok - " + msg);
}
async function throws(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn();
  } catch {
    passed++;
    console.log("  ok - " + msg);
    return;
  }
  throw new Error("FAIL (expected throw): " + msg);
}

async function reset() {
  await prisma.prizeDistribution.deleteMany();
  await prisma.prizeEvent.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shareHolding.deleteMany();
  await prisma.offering.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();

  const buyer1 = await prisma.user.create({
    data: { email: "b1@test.local", name: "Buyer One", passwordHash: "x" },
  });
  const buyer2 = await prisma.user.create({
    data: { email: "b2@test.local", name: "Buyer Two", passwordHash: "x" },
  });
  const off = await prisma.offering.create({
    data: {
      slug: "test-horse",
      name: "Test Horse",
      discipline: "Pacer",
      totalShares: 100,
      sharePriceCents: 5000, // $50
      mgmtFeeBps: 1000, // 10%
      status: "OPEN",
    },
  });

  console.log("checkout allocation + idempotency");
  const o1 = await allocateSharesFromPayment({
    userId: buyer1.id,
    offeringId: off.id,
    shares: 30,
    stripeSessionId: "sess_1",
  });
  const o1replay = await allocateSharesFromPayment({
    userId: buyer1.id,
    offeringId: off.id,
    shares: 30,
    stripeSessionId: "sess_1", // same session = replayed webhook
  });
  ok(o1.id === o1replay.id, "replayed webhook returns the same order");
  let cur = await prisma.offering.findUniqueOrThrow({ where: { id: off.id } });
  ok(cur.sharesSold === 30, "replay did not double-allocate (30 sold)");
  const h1 = await prisma.shareHolding.findUniqueOrThrow({
    where: { userId_offeringId: { userId: buyer1.id, offeringId: off.id } },
  });
  ok(h1.shares === 30, "holding is 30, not 60");

  await allocateSharesFromPayment({
    userId: buyer2.id,
    offeringId: off.id,
    shares: 20,
    stripeSessionId: "sess_2",
  });

  console.log("oversell guard");
  // 50 sold, 50 remaining - buying 60 must fail.
  await throws(
    () =>
      allocateSharesFromPayment({
        userId: buyer1.id,
        offeringId: off.id,
        shares: 60,
        stripeSessionId: "sess_3",
      }),
    "cannot allocate more shares than remain"
  );
  cur = await prisma.offering.findUniqueOrThrow({ where: { id: off.id } });
  ok(cur.sharesSold === 50, "sharesSold unchanged after rejected oversell");

  console.log("prizemoney distribution (pro-rata, exact cents)");
  // Gross $1000, 10% fee -> net $900 across 100 issued shares = $9/share.
  // Public holds 50 (buyer1 30, buyer2 20): distributed 45000; retained 45000.
  const { result } = await distributePrizeEvent({
    offeringId: off.id,
    raceName: "Test R1",
    grossCents: 100000,
  });
  ok(result.feeCents === 10000, "management fee is $100 (10%)");
  ok(result.distributedCents === 45000, "distributed $450 to public holders");
  ok(result.retainedCents === 45000, "retained $450 for unsold shares");
  ok(
    result.feeCents + result.distributedCents + result.retainedCents === 100000,
    "conservation: fee + distributed + retained == gross"
  );
  const b1 = await prisma.user.findUniqueOrThrow({ where: { id: buyer1.id } });
  const b2 = await prisma.user.findUniqueOrThrow({ where: { id: buyer2.id } });
  ok(b1.walletBalanceCents === 27000, "buyer1 credited $270 (30 shares)");
  ok(b2.walletBalanceCents === 18000, "buyer2 credited $180 (20 shares)");

  console.log("withdrawal guards + ledger integrity");
  await throws(
    () => withdraw({ userId: buyer1.id, amountCents: 30000 }),
    "cannot withdraw more than balance"
  );
  const after = await withdraw({ userId: buyer1.id, amountCents: 27000 });
  ok(after === 0, "withdrawing full balance leaves $0");
  await throws(
    () => withdraw({ userId: buyer1.id, amountCents: 1 }),
    "cannot withdraw from an empty wallet"
  );
  const txs = await prisma.walletTransaction.findMany({
    where: { userId: buyer1.id },
    orderBy: { createdAt: "asc" },
  });
  ok(
    txs.length === 2 &&
      txs[0].type === "PRIZE_PAYOUT" &&
      txs[1].type === "WITHDRAWAL",
    "ledger shows payout then withdrawal"
  );
  ok(txs[1].balanceAfterCents === 0, "final ledger balance row is $0");

  await reset();
  console.log(`\nAll flow tests passed (${passed} assertions).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n" + e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
