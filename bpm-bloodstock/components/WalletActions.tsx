"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents, dollarsToCents } from "@/lib/money";
import { StripeTopUp } from "./StripeTopUp";

const PRESETS = [5000, 10000, 25000, 50000];

export function WalletActions({
  balanceCents,
  demoMode,
}: {
  balanceCents: number;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"topup" | "withdraw">("topup");

  return (
    <div className="card p-6">
      <div className="mb-5 flex gap-1 rounded-lg bg-racing-975/60 p-1">
        {(["topup", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-gold text-racing-950"
                : "text-cream/60 hover:text-cream"
            }`}
          >
            {t === "topup" ? "Top up" : "Withdraw"}
          </button>
        ))}
      </div>

      {tab === "topup" ? (
        <TopUpPanel demoMode={demoMode} onDone={() => router.refresh()} />
      ) : (
        <WithdrawPanel
          balanceCents={balanceCents}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

function TopUpPanel({
  demoMode,
  onDone,
}: {
  demoMode: boolean;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("100.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);

  const cents = dollarsToCents(amount);

  async function start() {
    setError(null);
    if (cents <= 0) return setError("Enter an amount greater than zero");
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Top-up failed");

      if (data.mode === "demo") {
        onDone();
      } else {
        setStripe({
          clientSecret: data.clientSecret,
          publishableKey: data.publishableKey,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (stripe) {
    return (
      <StripeTopUp
        clientSecret={stripe.clientSecret}
        publishableKey={stripe.publishableKey}
        amountCents={cents}
        onSuccess={onDone}
        onCancel={() => setStripe(null)}
      />
    );
  }

  return (
    <div>
      <label className="field-label">Amount (AUD)</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/50">
          $
        </span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="field pl-7"
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount((p / 100).toFixed(2))}
            className="rounded-md border border-white/10 py-2 text-sm text-cream/70 hover:border-gold/40 hover:text-gold"
          >
            {formatCents(p, { withSymbol: true }).replace(".00", "")}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <button onClick={start} disabled={busy} className="btn-gold mt-5 w-full">
        {busy ? "Please wait…" : `Add ${formatCents(cents)}`}
      </button>

      <p className="mt-3 text-center text-[11px] text-cream/45">
        {demoMode ? (
          <>
            <span className="text-gold-200">Demo mode</span> — no real card
            needed. Funds are credited instantly. Add a Stripe key to enable the
            live Payment Element.
          </>
        ) : (
          "Secured by Stripe. You'll enter card details on the next step."
        )}
      </p>
    </div>
  );
}

function WithdrawPanel({
  balanceCents,
  onDone,
}: {
  balanceCents: number;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = dollarsToCents(amount);

  async function withdraw() {
    setError(null);
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
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="field-label">Amount to withdraw (AUD)</label>
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
        />
      </div>
      <button
        onClick={() => setAmount((balanceCents / 100).toFixed(2))}
        className="mt-2 text-xs text-gold hover:underline"
      >
        Withdraw full balance ({formatCents(balanceCents)})
      </button>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <button onClick={withdraw} disabled={busy} className="btn-outline mt-5 w-full">
        {busy ? "Processing…" : "Request withdrawal"}
      </button>
      <p className="mt-3 text-center text-[11px] text-cream/45">
        In production this pays out to your bank via Stripe Connect. In this
        scaffold the bank transfer is stubbed; the ledger debit is real.
      </p>
    </div>
  );
}
