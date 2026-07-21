/**
 * Lightweight assertions for the distribution engine. Run: npx tsx lib/distribution.test.ts
 * (No test framework needed - keeps the scaffold dependency-light.)
 */
import { computeDistribution } from "./distribution";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
}

// 1. Even split, fully subscribed, no fee.
{
  const r = computeDistribution({
    grossCents: 10000,
    mgmtFeeBps: 0,
    totalShares: 100,
    holders: [
      { userId: "a", shares: 50 },
      { userId: "b", shares: 50 },
    ],
  });
  assert(r.feeCents === 0, "no fee");
  assert(r.retainedCents === 0, "fully subscribed => nothing retained");
  assert(r.distributedCents === 10000, "all distributed");
  assert(r.payouts.find((p) => p.userId === "a")!.amountCents === 5000, "a gets half");
}

// 2. Management fee skimmed off the top.
{
  const r = computeDistribution({
    grossCents: 10000,
    mgmtFeeBps: 1000, // 10%
    totalShares: 100,
    holders: [{ userId: "a", shares: 100 }],
  });
  assert(r.feeCents === 1000, "10% fee");
  assert(r.distributedCents === 9000, "net distributed");
}

// 3. Partially subscribed: unsold shares' portion is retained, not redistributed.
{
  const r = computeDistribution({
    grossCents: 10000,
    mgmtFeeBps: 0,
    totalShares: 100,
    holders: [{ userId: "a", shares: 40 }], // 60 shares unsold
  });
  assert(r.payouts[0].amountCents === 4000, "holder gets exactly their 40% share");
  assert(r.retainedCents === 6000, "60% retained by house");
  assert(
    r.feeCents + r.distributedCents + r.retainedCents === 10000,
    "conservation of cents"
  );
}

// 4. Indivisible amounts - every cent accounted for via largest remainder.
{
  const r = computeDistribution({
    grossCents: 10000, // $100
    mgmtFeeBps: 0,
    totalShares: 3,
    holders: [
      { userId: "a", shares: 1 },
      { userId: "b", shares: 1 },
      { userId: "c", shares: 1 },
    ],
  });
  const sum = r.payouts.reduce((s, p) => s + p.amountCents, 0);
  assert(sum === 10000, "3-way split of $100 loses no cents");
  const amounts = r.payouts.map((p) => p.amountCents).sort();
  assert(
    amounts[0] === 3333 && amounts[2] === 3334,
    "remainder cent handed to exactly one holder"
  );
}

// 5. Weighted + fee + partial, big numbers - invariant must hold.
{
  const r = computeDistribution({
    grossCents: 123457,
    mgmtFeeBps: 1234,
    totalShares: 1000,
    holders: [
      { userId: "a", shares: 333 },
      { userId: "b", shares: 111 },
      { userId: "c", shares: 7 },
    ],
  });
  assert(
    r.feeCents + r.distributedCents + r.retainedCents === 123457,
    "conservation with fee + partial subscription"
  );
  assert(r.distributedCents >= 0 && r.retainedCents >= 0, "no negatives");
}

console.log(`All distribution tests passed (${passed} assertions).`);
