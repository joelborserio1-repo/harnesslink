import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SilksTile, ShareProgress } from "@/components/Offering";
import { formatCents } from "@/lib/money";
import { BuyWidget } from "./BuyWidget";

export const dynamic = "force-dynamic";

export default async function OfferingDetail({
  params,
}: {
  params: { slug: string };
}) {
  const offering = await prisma.offering.findUnique({
    where: { slug: params.slug },
    include: {
      prizeEvents: { orderBy: { raceDate: "desc" } },
      _count: { select: { holdings: true } },
    },
  });
  if (!offering) notFound();

  const user = await getCurrentUser();
  const remaining = offering.totalShares - offering.sharesSold;
  const totalPrize = offering.prizeEvents.reduce(
    (s, e) => s + e.grossCents,
    0
  );

  const facts = [
    ["Discipline", offering.discipline],
    ["Trainer", offering.trainer || "—"],
    ["Sire", offering.sire || "—"],
    ["Dam", offering.dam || "—"],
    ["Total shares", offering.totalShares.toLocaleString()],
    ["Management fee", `${(offering.mgmtFeeBps / 100).toFixed(0)}%`],
  ] as const;

  return (
    <div className="container-bpm py-12">
      <Link href="/offerings" className="text-sm text-cream/50 hover:text-gold">
        ← All horses
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* LEFT */}
        <div>
          <div className="flex items-center gap-5">
            <SilksTile heroColor={offering.heroColor} size="h-20 w-20" />
            <div>
              <p className="eyebrow">{offering.discipline}</p>
              <h1 className="mt-1 font-heading text-4xl font-bold text-cream">
                {offering.name}
              </h1>
              <p className="mt-1 text-cream/60">{offering.tagline}</p>
            </div>
          </div>

          <div className="card mt-8 p-6">
            <ShareProgress
              sold={offering.sharesSold}
              total={offering.totalShares}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-white/10 bg-racing-975/40 p-4"
              >
                <p className="text-[11px] uppercase tracking-wide text-cream/45">
                  {k}
                </p>
                <p className="mt-1 font-heading font-semibold text-cream">{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-xl font-bold text-cream">
              About this horse
            </h2>
            <div className="brand-rule mt-3 max-w-[120px]" />
            <p className="mt-4 leading-relaxed text-cream/70">
              {offering.description}
            </p>
          </div>

          {/* Prizemoney history */}
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-cream">
                Prizemoney &amp; results
              </h2>
              {totalPrize > 0 && (
                <span className="text-sm text-gold">
                  {formatCents(totalPrize)} earned
                </span>
              )}
            </div>
            <div className="brand-rule mt-3 max-w-[120px]" />
            {offering.prizeEvents.length === 0 ? (
              <p className="mt-4 text-sm text-cream/50">
                No results recorded yet. When this horse earns, distributions
                will appear here and land in shareholders&apos; wallets.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {offering.prizeEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-racing-975/40 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-cream">{e.raceName}</p>
                      <p className="text-xs text-cream/45">
                        {new Date(e.raceDate).toLocaleDateString("en-AU")} ·{" "}
                        {formatCents(e.distributedCents)} to shareholders
                      </p>
                    </div>
                    <span className="font-heading font-bold text-gold">
                      {formatCents(e.grossCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT — sticky buy widget */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BuyWidget
            slug={offering.slug}
            sharePriceCents={offering.sharePriceCents}
            remaining={remaining}
            isOpen={offering.status === "OPEN" && remaining > 0}
            signedIn={!!user}
          />
          <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-cream/40">
            Shares are paid for from your BPM wallet. Prizemoney is distributed
            pro-rata to shareholders after a {(offering.mgmtFeeBps / 100).toFixed(0)}%
            management fee.
          </p>
        </div>
      </div>
    </div>
  );
}
