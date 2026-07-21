import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getStripe, isDemoMode } from "@/lib/stripe";
import { creditDeposit } from "@/lib/wallet";

const schema = z.object({
  amountCents: z.number().int().positive().max(100_000_00),
});

/**
 * Starts a wallet top-up.
 *
 *  - DEMO MODE (no Stripe key): immediately credits the wallet and returns
 *    { mode: "demo" }. Lets the whole product be exercised with zero config.
 *
 *  - STRIPE MODE: creates a PaymentIntent and returns its client_secret. The
 *    client confirms it with the Stripe Payment Element; the webhook
 *    (/api/stripe/webhook) credits the wallet on payment_intent.succeeded.
 */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let amountCents: number;
  try {
    ({ amountCents } = schema.parse(await req.json()));
  } catch {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (isDemoMode()) {
    const balance = await creditDeposit({
      userId: user.id,
      amountCents,
      description: "Wallet top-up (demo)",
      stripeRef: "demo",
    });
    return NextResponse.json({ mode: "demo", balanceCents: balance });
  }

  const stripe = getStripe()!;
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "aud",
    automatic_payment_methods: { enabled: true },
    metadata: { userId: user.id, purpose: "wallet_topup" },
  });

  return NextResponse.json({
    mode: "stripe",
    clientSecret: intent.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
}
