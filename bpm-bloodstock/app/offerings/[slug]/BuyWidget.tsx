"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

export function BuyWidget({
  slug,
  sharePriceCents,
  remaining,
  isOpen,
  signedIn,
}: {
  slug: string;
  sharePriceCents: number;
  remaining: number;
  isOpen: boolean;
  signedIn: boolean;
}) {
  const [shares, setShares] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = shares * sharePriceCents;

  // Quick "spend this much" buttons → snap to whole shares.
  const tiers = [50, 100, 200, 500]
    .map((d) => Math.max(1, Math.round((d * 100) / sharePriceCents)))
    .filter((s, i, arr) => s <= remaining && arr.indexOf(s) === i);

  async function buyNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offerings/${slug}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shares }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      // Stripe hosted checkout, or the demo success redirect.
      window.location.href = data.url || data.redirect;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="card p-6">
        <p className="badge-full">Fully subscribed</p>
        <p className="mt-3 text-sm text-cream/60">
          This horse is fully owned. Browse other horses open for ownership.
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

      {tiers.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {tiers.map((s) => (
            <button
              key={s}
              onClick={() => setShares(s)}
              className={`rounded-md border py-2 text-xs font-semibold transition ${
                shares === s
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-white/10 text-cream/70 hover:border-gold/40 hover:text-gold"
              }`}
            >
              {formatCents(s * sharePriceCents).replace(".00", "")}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between rounded-lg border border-white/10 bg-racing-975/50 p-4">
        <span className="text-sm text-cream/55">Total</span>
        <span className="font-heading text-xl font-bold text-gold">
          {formatCents(totalCents)}
        </span>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-5">
        {!signedIn ? (
          <a href={`/login?next=/offerings/${slug}`} className="btn-gold w-full">
            Sign in to buy
          </a>
        ) : (
          <button onClick={buyNow} disabled={busy} className="btn-gold w-full">
            {busy ? "Taking you to checkout…" : `Buy now · ${formatCents(totalCents)}`}
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-cream/45">
        Secure card checkout. No account balance needed — pay once, own your
        shares.
      </p>
    </div>
  );
}
