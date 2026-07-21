"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dollarsToCents, formatCents } from "@/lib/money";

type OfferingLite = {
  id: string;
  name: string;
  discipline: string;
  sharesSold: number;
  totalShares: number;
  mgmtFeeBps: number;
};

export function AdminConsole({ offerings }: { offerings: OfferingLite[] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <PrizeMoneyForm offerings={offerings} />
      <CreateOfferingForm />
    </div>
  );
}

function PrizeMoneyForm({ offerings }: { offerings: OfferingLite[] }) {
  const router = useRouter();
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? "");
  const [raceName, setRaceName] = useState("");
  const [gross, setGross] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const selected = offerings.find((o) => o.id === offeringId);

  async function submit() {
    setError(null);
    setResult(null);
    const grossCents = dollarsToCents(gross);
    if (!offeringId) return setError("Select a horse");
    if (!raceName.trim()) return setError("Enter a race / event name");
    if (grossCents <= 0) return setError("Enter a prize amount");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/prizemoney", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offeringId, raceName, grossCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Distribution failed");
      setResult(data);
      setRaceName("");
      setGross("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <p className="eyebrow">Distribute prizemoney</p>
      <h2 className="mt-2 font-heading text-xl font-bold text-cream">
        Record a result
      </h2>
      <p className="mt-1 text-sm text-cream/55">
        Splits the prize pro-rata across shareholders&apos; wallets after the
        management fee. Every cent is accounted for.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label">Horse</label>
          <select
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            className="field"
          >
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} - {o.sharesSold}/{o.totalShares} shares sold
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Race / event</label>
          <input
            value={raceName}
            onChange={(e) => setRaceName(e.target.value)}
            placeholder="Won R7 Menangle, 12 Aug"
            className="field"
          />
        </div>
        <div>
          <label className="field-label">Gross prizemoney (AUD)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/50">
              $
            </span>
            <input
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              inputMode="decimal"
              placeholder="10000.00"
              className="field pl-7"
            />
          </div>
          {selected && (
            <p className="mt-1.5 text-[11px] text-cream/45">
              {(selected.mgmtFeeBps / 100).toFixed(0)}% management fee ·{" "}
              {selected.sharesSold}/{selected.totalShares} shares held by public
              (unsold shares&apos; portion is retained).
            </p>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm">
          <p className="font-semibold text-emerald-300">
            Distributed to {result.recipients} shareholder
            {result.recipients === 1 ? "" : "s"}.
          </p>
          <div className="mt-2 space-y-1 text-cream/70">
            <div className="flex justify-between">
              <span>Management fee</span>
              <span>{formatCents(result.feeCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Retained (unsold shares)</span>
              <span>{formatCents(result.retainedCents)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gold">
              <span>Paid to wallets</span>
              <span>{formatCents(result.distributedCents)}</span>
            </div>
          </div>
        </div>
      )}

      <button onClick={submit} disabled={busy} className="btn-gold mt-5 w-full">
        {busy ? "Distributing…" : "Distribute prizemoney"}
      </button>
    </div>
  );
}

function CreateOfferingForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const f = new FormData(e.currentTarget);
    const payload = {
      name: String(f.get("name")),
      discipline: String(f.get("discipline")) as "Pacer" | "Trotter",
      tagline: String(f.get("tagline") || ""),
      description: String(f.get("description") || ""),
      trainer: String(f.get("trainer") || ""),
      sire: String(f.get("sire") || ""),
      dam: String(f.get("dam") || ""),
      heroColor: String(f.get("heroColor")) as "gold" | "green",
      totalShares: Number(f.get("totalShares")),
      sharePriceCents: dollarsToCents(String(f.get("sharePrice"))),
      mgmtFeeBps: Math.round(Number(f.get("mgmtFeePct")) * 100),
    };
    setBusy(true);
    try {
      const res = await fetch("/api/admin/offerings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create");
      setOk(true);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6">
      <p className="eyebrow">New horse</p>
      <h2 className="mt-2 font-heading text-xl font-bold text-cream">
        List an offering
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="field-label">Horse name</label>
          <input name="name" required className="field" />
        </div>
        <div>
          <label className="field-label">Discipline</label>
          <select name="discipline" className="field">
            <option>Pacer</option>
            <option>Trotter</option>
          </select>
        </div>
        <div>
          <label className="field-label">Silks colour</label>
          <select name="heroColor" className="field">
            <option value="gold">Gold</option>
            <option value="green">Green</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="field-label">Tagline</label>
          <input name="tagline" className="field" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Description</label>
          <textarea name="description" rows={2} className="field" />
        </div>
        <div>
          <label className="field-label">Trainer</label>
          <input name="trainer" className="field" />
        </div>
        <div>
          <label className="field-label">Sire</label>
          <input name="sire" className="field" />
        </div>
        <div>
          <label className="field-label">Dam</label>
          <input name="dam" className="field" />
        </div>
        <div>
          <label className="field-label">Total shares</label>
          <input
            name="totalShares"
            type="number"
            min={1}
            defaultValue={1000}
            required
            className="field"
          />
        </div>
        <div>
          <label className="field-label">Price / share ($)</label>
          <input
            name="sharePrice"
            inputMode="decimal"
            defaultValue="50.00"
            required
            className="field"
          />
        </div>
        <div>
          <label className="field-label">Mgmt fee (%)</label>
          <input
            name="mgmtFeePct"
            inputMode="decimal"
            defaultValue="10"
            required
            className="field"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-300">Offering created.</p>}

      <button disabled={busy} className="btn-gold mt-5 w-full">
        {busy ? "Creating…" : "Create offering"}
      </button>
    </form>
  );
}
