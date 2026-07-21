import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminConsole } from "@/components/AdminConsole";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin)
    return (
      <div className="container-bpm py-20 text-center">
        <h1 className="font-heading text-2xl font-bold text-cream">
          Admin only
        </h1>
        <p className="mt-2 text-cream/60">
          This area is restricted to BPM administrators.
        </p>
        <Link href="/" className="btn-gold mt-6">
          Back home
        </Link>
      </div>
    );

  const [offerings, events] = await Promise.all([
    prisma.offering.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.prizeEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { offering: { select: { name: true } } },
    }),
  ]);

  const totals = await prisma.walletTransaction.groupBy({
    by: ["type"],
    _sum: { amountCents: true },
  });
  const sumFor = (t: string) =>
    Math.abs(totals.find((x) => x.type === t)?._sum.amountCents ?? 0);

  const kpis = [
    { label: "Horses listed", value: offerings.length.toString() },
    { label: "Deposits", value: formatCents(sumFor("DEPOSIT")) },
    { label: "Shares sold", value: formatCents(sumFor("SHARE_PURCHASE")) },
    { label: "Prizemoney paid", value: formatCents(sumFor("PRIZE_PAYOUT")) },
  ];

  return (
    <div className="container-bpm py-12">
      <p className="eyebrow">Admin console</p>
      <h1 className="mt-1 font-heading text-4xl font-bold text-cream">
        Syndicate operations
      </h1>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-cream/50">
              {k.label}
            </p>
            <p className="mt-2 font-heading text-2xl font-bold text-gold">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <AdminConsole offerings={offerings} />
      </div>

      <div className="mt-10">
        <h2 className="font-heading text-xl font-bold text-cream">
          Recent distributions
        </h2>
        <div className="brand-rule mt-3 max-w-[120px]" />
        <div className="card mt-5 overflow-hidden">
          {events.length === 0 ? (
            <p className="p-6 text-sm text-cream/50">
              No prizemoney distributed yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-cream/45">
                  <th className="px-5 py-3 font-medium">Horse</th>
                  <th className="px-5 py-3 font-medium">Race</th>
                  <th className="px-5 py-3 text-right font-medium">Gross</th>
                  <th className="px-5 py-3 text-right font-medium">Fee</th>
                  <th className="px-5 py-3 text-right font-medium">To wallets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 font-semibold text-cream">
                      {e.offering.name}
                    </td>
                    <td className="px-5 py-3 text-cream/70">{e.raceName}</td>
                    <td className="px-5 py-3 text-right text-cream/70">
                      {formatCents(e.grossCents)}
                    </td>
                    <td className="px-5 py-3 text-right text-cream/60">
                      {formatCents(e.feeCents)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gold">
                      {formatCents(e.distributedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
