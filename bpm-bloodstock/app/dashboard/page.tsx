import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SilksTile } from "@/components/Offering";
import { formatCents, pct } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [holdings, prizeTotal, recentTx] = await Promise.all([
    prisma.shareHolding.findMany({
      where: { userId: user.id, shares: { gt: 0 } },
      include: { offering: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.walletTransaction.aggregate({
      where: { userId: user.id, type: "PRIZE_PAYOUT" },
      _sum: { amountCents: true },
    }),
    prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const investedCents = holdings.reduce(
    (s, h) => s + h.shares * h.offering.sharePriceCents,
    0
  );

  const cards = [
    { label: "Wallet balance", value: formatCents(user.walletBalanceCents), accent: true },
    { label: "Invested (at cost)", value: formatCents(investedCents) },
    { label: "Prizemoney earned", value: formatCents(prizeTotal._sum.amountCents ?? 0) },
    { label: "Horses owned", value: holdings.length.toString() },
  ];

  return (
    <div className="container-bpm py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My Stable</p>
          <h1 className="mt-1 font-heading text-4xl font-bold text-cream">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/wallet" className="btn-gold">
          Manage wallet
        </Link>
      </div>

      {/* summary cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`card p-5 ${c.accent ? "ring-1 ring-gold/30" : ""}`}
          >
            <p className="text-xs uppercase tracking-wide text-cream/50">
              {c.label}
            </p>
            <p
              className={`mt-2 font-heading text-2xl font-bold ${
                c.accent ? "text-gold" : "text-cream"
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* portfolio */}
        <div>
          <h2 className="font-heading text-xl font-bold text-cream">
            Your horses
          </h2>
          <div className="brand-rule mt-3 max-w-[120px]" />

          {holdings.length === 0 ? (
            <div className="card mt-5 p-8 text-center">
              <p className="text-cream/60">You don&apos;t own any shares yet.</p>
              <Link href="/offerings" className="btn-gold mt-4">
                Browse horses
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {holdings.map((h) => (
                <Link
                  key={h.id}
                  href={`/offerings/${h.offering.slug}`}
                  className="card flex items-center gap-4 p-4 transition hover:border-gold/40"
                >
                  <SilksTile heroColor={h.offering.heroColor} size="h-12 w-12" />
                  <div className="flex-1">
                    <p className="font-heading font-bold text-cream">
                      {h.offering.name}
                    </p>
                    <p className="text-xs text-cream/50">
                      {h.offering.discipline} · {h.shares} shares ·{" "}
                      {pct(h.shares, h.offering.totalShares).toFixed(2)}% owned
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-gold">
                      {formatCents(h.shares * h.offering.sharePriceCents)}
                    </p>
                    <p className="text-[11px] text-cream/45">at cost</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* recent activity */}
        <div>
          <h2 className="font-heading text-xl font-bold text-cream">
            Recent activity
          </h2>
          <div className="brand-rule mt-3 max-w-[120px]" />
          <div className="card mt-5 divide-y divide-white/5">
            {recentTx.length === 0 ? (
              <p className="p-5 text-sm text-cream/50">No activity yet.</p>
            ) : (
              recentTx.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-cream">
                      {t.description || t.type}
                    </p>
                    <p className="text-[11px] text-cream/40">
                      {new Date(t.createdAt).toLocaleString("en-AU")}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${
                      t.amountCents >= 0 ? "text-emerald-300" : "text-cream/70"
                    }`}
                  >
                    {t.amountCents >= 0 ? "+" : "−"}
                    {formatCents(Math.abs(t.amountCents), { withSymbol: true })}
                  </span>
                </div>
              ))
            )}
          </div>
          <Link
            href="/wallet"
            className="mt-3 block text-center text-sm text-gold hover:underline"
          >
            View full wallet →
          </Link>
        </div>
      </div>
    </div>
  );
}
