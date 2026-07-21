import { prisma } from "@/lib/db";
import { OfferingCard } from "@/components/Offering";

export const dynamic = "force-dynamic";

export default async function OfferingsPage() {
  const offerings = await prisma.offering.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="container-bpm py-14">
      <p className="eyebrow">The book</p>
      <h1 className="mt-2 font-heading text-4xl font-bold text-cream">
        Our horses
      </h1>
      <p className="mt-3 max-w-xl text-cream/60">
        Every horse is offered as micro-shares. Buy a parcel, follow the journey,
        and share in whatever the horse earns on the track.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {offerings.map((o) => (
          <OfferingCard key={o.id} offering={o} />
        ))}
      </div>
    </div>
  );
}
