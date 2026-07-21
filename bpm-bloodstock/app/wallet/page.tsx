import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WalletActions } from "@/components/WalletActions";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Top-up",
  SHARE_PURCHASE: "Share purchase",
  PRIZE_PAYOUT: "Prizemoney",
  WITHDRAWAL: "Withdrawal",
};

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="container-bpm py-12">
      <p className="eyebrow">Wallet</p>
      <h1 className="mt-1 font-heading text-4xl font-bold text-cream">
        Your wallet
      </h1>
      <p className="mt-2 text-cream/60">
        Prizemoney from your horses lands here. Cash out whenever you like.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-gold-500 to-gold-300 p-6 text-racing-950">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                Wallet
              </p>
              <p className="mt-2 font-heading text-4xl font-bold">
                {formatCents(user.walletBalanceCents)}
              </p>
              <p className="mt-1 text-xs opacity-70">{user.name}</p>
            </div>
          </div>

          <WalletActions balanceCents={user.walletBalanceCents} />
        </div>

        {/* ledger */}
        <div>
          <h2 className="font-heading text-xl font-bold text-cream">
            Transaction history
          </h2>
          <div className="brand-rule mt-3 max-w-[120px]" />
          <div className="card mt-5 overflow-hidden">
            {transactions.length === 0 ? (
              <p className="p-6 text-sm text-cream/50">No transactions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-cream/45">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Detail</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-3 text-cream/60">
                        {new Date(t.createdAt).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge border-white/15 bg-white/5 text-cream/70">
                          {TYPE_LABEL[t.type] ?? t.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-cream/70">
                        {t.description}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          t.amountCents >= 0 ? "text-emerald-300" : "text-cream/70"
                        }`}
                      >
                        {t.amountCents >= 0 ? "+" : "−"}
                        {formatCents(Math.abs(t.amountCents))}
                      </td>
                      <td className="px-5 py-3 text-right text-cream/60">
                        {formatCents(t.balanceAfterCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
