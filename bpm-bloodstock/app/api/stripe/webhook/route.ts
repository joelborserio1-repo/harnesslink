import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { allocateSharesFromPayment } from "@/lib/wallet";

// Stripe needs the raw body to verify the signature.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
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

  // Direct share purchase (e-commerce Checkout). Allocation is idempotent by
  // the Checkout Session id, so replays are safe.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    if (
      session.payment_status === "paid" &&
      session.metadata?.purpose === "share_purchase"
    ) {
      await allocateSharesFromPayment({
        userId: session.metadata.userId,
        offeringId: session.metadata.offeringId,
        shares: Number(session.metadata.shares),
        stripeSessionId: session.id,
      });
    }
  }

  return NextResponse.json({ received: true });
}
