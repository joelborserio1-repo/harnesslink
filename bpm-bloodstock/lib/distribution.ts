/**
 * Prizemoney distribution engine.
 *
 * The core is a PURE function so it can be unit-tested and reasoned about in
 * isolation from the database. Given a gross prize (in cents), a management fee
 * (basis points), the total shares issued and the public shareholders' current
 * holdings, it returns exactly how many cents each shareholder receives - with
 * every cent accounted for.
 *
 * Design decisions (the tricky bits):
 *
 *  1. Integer cents only. No floats touch a balance.
 *  2. Management fee is skimmed off the GROSS first (syndicate revenue).
 *  3. The net is split across ALL issued shares, not just sold ones. Shares the
 *     syndicate still holds (unsold) earn their pro-rata slice too - that slice
 *     is "retained" (house money), NOT silently redistributed to the public.
 *     This keeps per-share value constant regardless of how much has sold, which
 *     is the correct and fair behaviour for a partially-subscribed offering.
 *  4. Remainder cents (division never divides evenly) are allocated by the
 *     Largest Remainder Method to the public shareholders, so the sum of all
 *     public payouts + fee + retained == gross, exactly. No cent is created or
 *     lost.
 */

export interface HolderInput {
  userId: string;
  shares: number;
}

export interface HolderPayout {
  userId: string;
  shares: number;
  amountCents: number;
}

export interface DistributionResult {
  grossCents: number;
  feeCents: number;
  /** Slice attributable to unsold (house-held) shares. */
  retainedCents: number;
  /** Total actually credited to public shareholders. */
  distributedCents: number;
  payouts: HolderPayout[];
}

export function computeDistribution(params: {
  grossCents: number;
  mgmtFeeBps: number; // basis points, 1000 = 10%
  totalShares: number;
  holders: HolderInput[]; // public shareholders only
}): DistributionResult {
  const { grossCents, mgmtFeeBps, totalShares } = params;
  const holders = params.holders.filter((h) => h.shares > 0);

  if (grossCents < 0) throw new Error("grossCents must be >= 0");
  if (totalShares <= 0) throw new Error("totalShares must be > 0");

  // 1. Management fee off the top (floor - syndicate never over-collects).
  const feeCents = Math.floor((grossCents * mgmtFeeBps) / 10000);
  const netCents = grossCents - feeCents;

  const publicShares = holders.reduce((s, h) => s + h.shares, 0);
  if (publicShares > totalShares) {
    throw new Error("public shares exceed total issued shares");
  }

  // 2. Ideal (fractional) amount per holder = net * (shares / totalShares).
  //    Take the floor for each, then hand out leftover cents by largest
  //    fractional remainder.
  const withRemainder = holders.map((h) => {
    const exact = (netCents * h.shares) / totalShares;
    const floor = Math.floor(exact);
    return { ...h, floor, remainder: exact - floor };
  });

  const baseSum = withRemainder.reduce((s, h) => s + h.floor, 0);

  // 3. The "retained" slice is the net that maps to unsold shares. It is the
  //    net minus everything the public is entitled to (base + distributed
  //    remainder cents). Public remainder cents are the leftover between the
  //    public's ideal total and their floored total.
  const publicIdealCents = Math.round((netCents * publicShares) / totalShares);
  // Cents still to hand out to the public after flooring.
  let leftoverForPublic = publicIdealCents - baseSum;
  if (leftoverForPublic < 0) leftoverForPublic = 0;

  // Largest Remainder Method: sort by fractional remainder desc, tie-break by
  // shares desc then userId for determinism.
  const ranked = [...withRemainder].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    if (b.shares !== a.shares) return b.shares - a.shares;
    return a.userId < b.userId ? -1 : 1;
  });

  const extra = new Map<string, number>();
  for (let i = 0; i < leftoverForPublic && i < ranked.length; i++) {
    extra.set(ranked[i].userId, (extra.get(ranked[i].userId) ?? 0) + 1);
  }

  const payouts: HolderPayout[] = withRemainder.map((h) => ({
    userId: h.userId,
    shares: h.shares,
    amountCents: h.floor + (extra.get(h.userId) ?? 0),
  }));

  const distributedCents = payouts.reduce((s, p) => s + p.amountCents, 0);
  const retainedCents = netCents - distributedCents;

  // Invariant: nothing created or destroyed.
  if (feeCents + distributedCents + retainedCents !== grossCents) {
    throw new Error("distribution invariant violated");
  }

  return {
    grossCents,
    feeCents,
    retainedCents,
    distributedCents,
    payouts: payouts.filter((p) => p.amountCents > 0),
  };
}
