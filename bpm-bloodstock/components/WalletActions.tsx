"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents, dollarsToCents } from "@/lib/money";

/**
 * Winnings wallet: prizemoney lands here automatically. Members can withdraw to
 * their bank. (No deposits — shares are bought directly via card checkout.)
 */
export function WalletActions({ balanceCents }: { balanceCents: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const cents = dollarsToCents(amount);

  async function withdraw() {
    setError(null);
    setDone(false);
    if (cents <= 0) return setError("Enter an amount greater than zero");
    if (cents > balanceCents) return setError("Amount exceeds your balance");
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      setAmount("");
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-heading text-lg font-bold text-cream">
        Withdraw your winnings
      </h2>
      <p className="mt-1 text-sm text-cream/55">
        Prizemoney lands here automatically. Cash out to your bank whenever.
      </p>

      <div className="mt-5">
        <label className="field-label">Amount (AUD)</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/50">
            $
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="field pl-7"
            disabled={balanceCents <= 0}
          />
        </div>
        {balanceCents > 0 && (
          <button
            onClick={() => setAmount((balanceCents / 100).toFixed(2))}
            className="mt-2 text-xs text-gold hover:underline"
          >
            Withdraw full balance ({formatCents(balanceCents)})
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {done && (
        <p className="mt-3 text-sm text-emerald-300">Withdrawal requested.</p>
      )}

      <button
        onClick={withdraw}
        disabled={busy || balanceCents <= 0}
        className="btn-gold mt-5 w-full"
      >
        {busy ? "Processing…" : "Request withdrawal"}
      </button>
      <p className="mt-3 text-center text-[11px] text-cream/45">
        In production this pays out to your bank via Stripe Connect. In this
        scaffold the transfer is stubbed; the ledger debit is real.
      </p>
    </div>
  );
}
