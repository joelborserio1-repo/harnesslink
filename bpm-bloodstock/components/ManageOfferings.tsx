"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { dollarsToCents, formatCents } from "@/lib/money";

export type OfferingRow = {
  id: string;
  name: string;
  slug: string;
  discipline: string;
  tagline: string;
  description: string;
  trainer: string;
  sire: string;
  dam: string;
  heroColor: string;
  sharePriceCents: number;
  totalShares: number;
  sharesSold: number;
  mgmtFeeBps: number;
  status: string;
  imageUrl: string;
};

export function ManageOfferings({ offerings }: { offerings: OfferingRow[] }) {
  return (
    <div className="space-y-4">
      {offerings.length === 0 && (
        <p className="text-sm text-sage">No horses yet. Add one below.</p>
      )}
      {offerings.map((o) => (
        <Row key={o.id} o={o} />
      ))}
    </div>
  );
}

function Row({ o }: { o: OfferingRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/offerings/${o.id}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMsg("Photo updated");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const f = new FormData(e.currentTarget);
    const payload = {
      tagline: String(f.get("tagline") || ""),
      description: String(f.get("description") || ""),
      sharePriceCents: dollarsToCents(String(f.get("sharePrice"))),
      totalShares: Number(f.get("totalShares")),
      mgmtFeeBps: Math.round(Number(f.get("mgmtFeePct")) * 100),
      status: String(f.get("status")) as "OPEN" | "CLOSED" | "RETIRED",
    };
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/offerings/${o.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Saved");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${o.name}"? This removes its holdings and results too.`))
      return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/offerings/${o.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        {/* thumb */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-green-600 bg-green-900">
          {o.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={o.imageUrl} alt={o.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[10px] text-sage">
              no photo
            </div>
          )}
        </div>

        <div className="flex-1">
          <p className="font-heading font-bold text-cream">{o.name}</p>
          <p className="text-xs text-sage">
            {o.discipline ? o.discipline + " · " : ""}
            {formatCents(o.sharePriceCents)}/share · {o.sharesSold}/{o.totalShares}{" "}
            sold · {o.status.toLowerCase()}
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadImage(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn-outline px-3 py-1.5 text-xs"
        >
          Photo
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-outline px-3 py-1.5 text-xs"
        >
          {open ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"
        >
          Delete
        </button>
      </div>

      {(msg || err) && (
        <p className={`mt-2 text-xs ${err ? "text-red-300" : "text-emerald-300"}`}>
          {err || msg}
        </p>
      )}

      {open && (
        <form onSubmit={save} className="mt-4 grid grid-cols-2 gap-3 border-t border-green-600 pt-4">
          <div className="col-span-2">
            <label className="field-label">Tagline</label>
            <input name="tagline" defaultValue={o.tagline} className="field" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Description</label>
            <textarea name="description" rows={2} defaultValue={o.description} className="field" />
          </div>
          <div>
            <label className="field-label">Price / share ($)</label>
            <input
              name="sharePrice"
              inputMode="decimal"
              defaultValue={(o.sharePriceCents / 100).toFixed(2)}
              className="field"
            />
          </div>
          <div>
            <label className="field-label">Total shares</label>
            <input name="totalShares" type="number" min={o.sharesSold} defaultValue={o.totalShares} className="field" />
          </div>
          <div>
            <label className="field-label">Mgmt fee (%)</label>
            <input
              name="mgmtFeePct"
              inputMode="decimal"
              defaultValue={(o.mgmtFeeBps / 100).toString()}
              className="field"
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select name="status" defaultValue={o.status} className="field">
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
          <div className="col-span-2">
            <button disabled={busy} className="btn-gold w-full">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
