import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { creditDeposit } from "@/lib/wallet";
import { prisma } from "@/lib/db";

// Stripe needs the raw body to verify the signature.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 400 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as any;
    const userId = intent.metadata?.userId;
    const purpose = intent.metadata?.purpose;

    if (purpose === "wallet_topup" && userId) {
      // Idempotency: skip if we already credited this PaymentIntent.
      const already = await prisma.walletTransaction.findFirst({
        where: { stripeRef: intent.id },
      });
      if (!already) {
        await creditDeposit({
          userId,
          amountCents: intent.amount_received ?? intent.amount,
          description: "Wallet top-up",
          stripeRef: intent.id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
