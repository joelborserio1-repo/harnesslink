import { prisma } from "./db";
import { computeDistribution } from "./distribution";
import type { Prisma } from "@prisma/client";

export type WalletTxType =
  | "DEPOSIT"
  | "SHARE_PURCHASE"
  | "PRIZE_PAYOUT"
  | "WITHDRAWAL";

export class WalletError extends Error {}

type Tx = Prisma.TransactionClient;

/**
 * The single choke-point for every balance change. Reads the current balance,
 * applies a signed delta, refuses to let a balance go negative, writes the new
 * balance on the user AND appends an immutable ledger row. Must run inside a
 * transaction so balance + ledger never diverge.
 */
export async function applyWalletDelta(
  tx: Tx,
  args: {
    userId: string;
    type: WalletTxType;
    amountCents: number; // signed
    description?: string;
    stripeRef?: string;
    relatedId?: string;
  }
): Promise<number> {
  const user = await tx.user.findUnique({
    where: { id: args.userId },
    select: { walletBalanceCents: true },
  });
  if (!user) throw new WalletError("User not found");

  const balanceAfter = user.walletBalanceCents + args.amountCents;
  if (balanceAfter < 0) {
    throw new WalletError("Insufficient wallet balance");
  }

  await tx.user.update({
    where: { id: args.userId },
    data: { walletBalanceCents: balanceAfter },
  });

  await tx.walletTransaction.create({
    data: {
      userId: args.userId,
      type: args.type,
      amountCents: args.amountCents,
      balanceAfterCents: balanceAfter,
      description: args.description ?? "",
      stripeRef: args.stripeRef,
      relatedId: args.relatedId,
    },
  });

  return balanceAfter;
}

/** Credit a wallet (top-up). Called after a confirmed Stripe payment (or demo). */
export async function creditDeposit(args: {
  userId: string;
  amountCents: number;
  stripeRef?: string;
  description?: string;
}): Promise<number> {
  if (args.amountCents <= 0) throw new WalletError("Deposit must be positive");
  return prisma.$transaction((tx) =>
    applyWalletDelta(tx, {
      userId: args.userId,
      type: "DEPOSIT",
      amountCents: args.amountCents,
      description: args.description ?? "Wallet top-up",
      stripeRef: args.stripeRef,
    })
  );
}

/** Withdraw funds from the wallet (payout to bank handled externally / stubbed). */
export async function withdraw(args: {
  userId: string;
  amountCents: number;
}): Promise<number> {
  if (args.amountCents <= 0) throw new WalletError("Withdrawal must be positive");
  return prisma.$transaction((tx) =>
    applyWalletDelta(tx, {
      userId: args.userId,
      type: "WITHDRAWAL",
      amountCents: -args.amountCents,
      description: "Withdrawal to bank account",
    })
  );
}

/**
 * Buy `shares` of an offering, paid from the wallet. Atomic:
 *  - re-checks availability under the transaction (guards oversell races)
 *  - debits the wallet
 *  - upserts the holding
 *  - increments sharesSold
 *  - records an Order
 */
export async function purchaseShares(args: {
  userId: string;
  offeringId: string;
  shares: number;
}) {
  const { userId, offeringId, shares } = args;
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new WalletError("Share quantity must be a positive whole number");
  }

  return prisma.$transaction(async (tx) => {
    const offering = await tx.offering.findUnique({ where: { id: offeringId } });
    if (!offering) throw new WalletError("Offering not found");
    if (offering.status !== "OPEN") {
      throw new WalletError("This offering is not open for investment");
    }
    const remaining = offering.totalShares - offering.sharesSold;
    if (shares > remaining) {
      throw new WalletError(
        `Only ${remaining} share${remaining === 1 ? "" : "s"} remaining`
      );
    }

    const totalCents = shares * offering.sharePriceCents;

    await applyWalletDelta(tx, {
      userId,
      type: "SHARE_PURCHASE",
      amountCents: -totalCents,
      description: `${shares} share${shares === 1 ? "" : "s"} · ${offering.name}`,
      relatedId: offeringId,
    });

    const order = await tx.order.create({
      data: {
        userId,
        offeringId,
        shares,
        unitPriceCents: offering.sharePriceCents,
        totalCents,
        status: "COMPLETED",
      },
    });

    await tx.offering.update({
      where: { id: offeringId },
      data: {
        sharesSold: offering.sharesSold + shares,
        status:
          offering.sharesSold + shares >= offering.totalShares
            ? "CLOSED"
            : offering.status,
      },
    });

    await tx.shareHolding.upsert({
      where: { userId_offeringId: { userId, offeringId } },
      create: { userId, offeringId, shares },
      update: { shares: { increment: shares } },
    });

    return order;
  });
}

/**
 * Record a prizemoney event and distribute it pro-rata across current
 * shareholders in one atomic transaction. Idempotent-ish: each call creates one
 * PrizeEvent; caller decides when to record.
 */
export async function distributePrizeEvent(args: {
  offeringId: string;
  raceName: string;
  raceDate?: Date;
  grossCents: number;
}) {
  const { offeringId, raceName, grossCents } = args;
  if (grossCents <= 0) throw new WalletError("Prize amount must be positive");

  return prisma.$transaction(async (tx) => {
    const offering = await tx.offering.findUnique({ where: { id: offeringId } });
    if (!offering) throw new WalletError("Offering not found");

    const holdings = await tx.shareHolding.findMany({
      where: { offeringId, shares: { gt: 0 } },
      select: { userId: true, shares: true },
    });

    const result = computeDistribution({
      grossCents,
      mgmtFeeBps: offering.mgmtFeeBps,
      totalShares: offering.totalShares,
      holders: holdings,
    });

    const event = await tx.prizeEvent.create({
      data: {
        offeringId,
        raceName,
        raceDate: args.raceDate ?? new Date(),
        grossCents: result.grossCents,
        mgmtFeeBps: offering.mgmtFeeBps,
        feeCents: result.feeCents,
        retainedCents: result.retainedCents,
        distributedCents: result.distributedCents,
        status: "DISTRIBUTED",
      },
    });

    for (const payout of result.payouts) {
      await applyWalletDelta(tx, {
        userId: payout.userId,
        type: "PRIZE_PAYOUT",
        amountCents: payout.amountCents,
        description: `Prizemoney · ${offering.name} · ${raceName}`,
        relatedId: event.id,
      });
      await tx.prizeDistribution.create({
        data: {
          prizeEventId: event.id,
          userId: payout.userId,
          shares: payout.shares,
          amountCents: payout.amountCents,
        },
      });
    }

    return { event, result };
  });
}
