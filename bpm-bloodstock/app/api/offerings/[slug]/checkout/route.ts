import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe, isDemoMode } from "@/lib/stripe";
import { allocateSharesFromPayment, WalletError } from "@/lib/wallet";
import crypto from "crypto";

const schema = z.object({ shares: z.number().int().positive() });

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * E-commerce style "Buy now": no wallet deposit. Creates a Stripe Checkout
 * Session and returns its redirect URL. Shares are allocated when the payment
 * confirms (webhook: checkout.session.completed).
 *
 * DEMO MODE (no Stripe key): allocates immediately and returns a redirect to
 * the success page, so the whole flow works with zero config.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const offering = await prisma.offering.findUnique({
    where: { slug: params.slug },
  });
  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }
  if (offering.status !== "OPEN") {
    return NextResponse.json(
      { error: "This offering is not open" },
      { status: 400 }
    );
  }

  let shares: number;
  try {
    ({ shares } = schema.parse(await req.json()));
  } catch {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const remaining = offering.totalShares - offering.sharesSold;
  if (shares > remaining) {
    return NextResponse.json(
      { error: `Only ${remaining} shares remaining` },
      { status: 400 }
    );
  }

  const totalCents = shares * offering.sharePriceCents;

  // ---- DEMO MODE: allocate right away ----
  if (isDemoMode()) {
    try {
      const order = await allocateSharesFromPayment({
        userId: user.id,
        offeringId: offering.id,
        shares,
        stripeSessionId: "demo_" + crypto.randomUUID(),
      });
      return NextResponse.json({
        mode: "demo",
        redirect: `/offerings/${offering.slug}/success?order=${order.id}`,
      });
    } catch (e: any) {
      const msg = e instanceof WalletError ? e.message : "Purchase failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // ---- STRIPE MODE: hosted Checkout redirect ----
  const stripe = getStripe()!;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: `StrideShares - ${offering.name}`,
            description: `${shares} share${shares === 1 ? "" : "s"} of ${offering.name}`,
          },
          unit_amount: offering.sharePriceCents,
        },
        quantity: shares,
      },
    ],
    metadata: {
      userId: user.id,
      offeringId: offering.id,
      shares: String(shares),
      purpose: "share_purchase",
    },
    payment_intent_data: {
      metadata: {
        userId: user.id,
        offeringId: offering.id,
        shares: String(shares),
      },
    },
    success_url: `${appUrl()}/offerings/${offering.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/offerings/${offering.slug}?cancelled=1`,
  });

  return NextResponse.json({ mode: "stripe", url: session.url, totalCents });
}
