"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";

export function BuyWidget({
  slug,
  sharePriceCents,
  remaining,
  isOpen,
  signedIn,
  walletBalanceCents,
}: {
  slug: string;
  sharePriceCents: number;
  remaining: number;
  isOpen: boolean;
  signedIn: boolean;
  walletBalanceCents: number;
}) {
  const router = useRouter();
  const [shares, setShares] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totalCents = shares * sharePriceCents;
  const insufficient = totalCents > walletBalanceCents;
  const canBuy =
    signedIn && isOpen && shares > 0 && shares <= remaining && !insufficient;

  const ownershipPct = useMemo(() => shares, [shares]);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offerings/${slug}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shares }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="card p-6">
        <p className="badge-full">Fully subscribed</p>
        <p className="mt-3 text-sm text-cream/60">
          This horse is fully owned. Browse other horses currently open for
          ownership.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-cream/60">Price per share</span>
        <span className="font-heading text-2xl font-bold text-gold">
          {formatCents(sharePriceCents)}
        </span>
      </div>

      <div className="mt-5">
        <label className="field-label">Number of shares</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-outline h-10 w-10 !px-0"
            onClick={() => setShares((s) => Math.max(1, s - 1))}
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={remaining}
            value={shares}
            onChange={(e) =>
              setShares(
                Math.max(1, Math.min(remaining, Number(e.target.value) || 1))
              )
            }
            className="field text-center"
          />
          <button
            type="button"
            className="btn-outline h-10 w-10 !px-0"
            onClick={() => setShares((s) => Math.min(remaining, s + 1))}
          >
            +
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-cream/45">
          {remaining.toLocaleString()} shares remaining
        </p>
      </div>

      <div className="mt-5 space-y-2 rounded-lg border border-white/10 bg-racing-975/50 p-4 text-sm">
        <Row label="Shares" value={ownershipPct.toLocaleString()} />
        <Row label="Total" value={formatCents(totalCents)} strong />
        {signedIn && (
          <Row
            label="Wallet balance"
            value={formatCents(walletBalanceCents)}
            muted
          />
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {done && (
        <p className="mt-3 text-sm text-emerald-300">
          Shares purchased — see them in your Stable.
        </p>
      )}

      <div className="mt-5">
        {!signedIn ? (
          <a href="/login" className="btn-gold w-full">
            Sign in to invest
          </a>
        ) : insufficient ? (
          <a href="/wallet" className="btn-gold w-full">
            Top up wallet to continue
          </a>
        ) : (
          <button
            onClick={buy}
            disabled={!canBuy || busy}
            className="btn-gold w-full"
          >
            {busy ? "Processing…" : `Buy ${shares} share${shares === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-cream/55">{label}</span>
      <span
        className={
          strong
            ? "font-heading text-base font-bold text-gold"
            : muted
            ? "text-cream/50"
            : "text-cream"
        }
      >
        {value}
      </span>
    </div>
  );
}
