import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { allocateSharesFromPayment } from "@/lib/wallet";
import { SilksTile } from "@/components/Offering";
import { formatCents, pct } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PurchaseSuccess({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { session_id?: string; order?: string };
}) {
  const offering = await prisma.offering.findUnique({
    where: { slug: params.slug },
  });
  if (!offering) notFound();
  const user = await getCurrentUser();

  // Resolve the order: demo passes ?order=, Stripe passes ?session_id=.
  let order = null;

  if (searchParams.order) {
    order = await prisma.order.findUnique({ where: { id: searchParams.order } });
  } else if (searchParams.session_id) {
    // Belt-and-suspenders: confirm the session with Stripe and allocate
    // (idempotent) in case the webhook hasn't landed yet.
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          searchParams.session_id
        );
        if (
          session.payment_status === "paid" &&
          session.metadata?.purpose === "share_purchase"
        ) {
          order = await allocateSharesFromPayment({
            userId: session.metadata.userId,
            offeringId: session.metadata.offeringId,
            shares: Number(session.metadata.shares),
            stripeSessionId: session.id,
          });
        }
      } catch {
        /* fall through to pending state */
      }
    }
    if (!order) {
      order = await prisma.order.findUnique({
        where: { stripeSessionId: searchParams.session_id },
      });
    }
  }

  const owned =
    user && order && order.userId === user.id ? order.shares : null;

  return (
    <div className="container-bpm py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-2xl text-[#2A2008]">
          ✓
        </div>

        {order ? (
          <>
            <h1 className="mt-6 font-heading text-4xl font-bold text-cream">
              You&apos;re an owner. 🏇
            </h1>
            <p className="mt-3 text-cream/70">
              Payment confirmed. Your StrideShares in{" "}
              <span className="font-semibold text-gold">{offering.name}</span>{" "}
              are locked in.
            </p>

            <div className="card mt-8 p-6 text-left">
              <div className="flex items-center gap-4">
                <SilksTile heroColor={offering.heroColor} size="h-14 w-14" />
                <div>
                  <p className="font-heading text-xl font-bold text-cream">
                    {offering.name}
                  </p>
                  <p className="text-sm text-cream/55">{offering.discipline}</p>
                </div>
              </div>
              <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
                <Row label="Shares purchased" value={String(order.shares)} />
                <Row
                  label="Your stake"
                  value={`${pct(order.shares, offering.totalShares).toFixed(2)}%`}
                />
                <Row label="Paid" value={formatCents(order.totalCents)} strong />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="btn-gold">
                Go to My Stable
              </Link>
              <Link href="/offerings" className="btn-outline">
                Buy into another horse
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-heading text-3xl font-bold text-cream">
              Payment received - finalising your shares…
            </h1>
            <p className="mt-3 text-cream/70">
              This takes a moment. Refresh this page, or head to your stable - 
              your shares will appear as soon as the payment clears.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/dashboard" className="btn-gold">
                Go to My Stable
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-cream/55">{label}</span>
      <span
        className={
          strong ? "font-heading text-base font-bold text-gold" : "text-cream"
        }
      >
        {value}
      </span>
    </div>
  );
}
