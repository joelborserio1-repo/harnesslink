"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type MediaSlot = {
  key: string;
  label: string;
  hint: string;
  src: string | null;
};

export function MediaManager({ slots }: { slots: MediaSlot[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {slots.map((s) => (
        <SlotCard key={s.key} slot={s} />
      ))}
    </div>
  );
}

function SlotCard({ slot }: { slot: MediaSlot }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function upload(file: File) {
    setErr(null);
    setOk(false);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/media/${slot.key}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setOk(true);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <p className="font-heading text-sm font-bold uppercase tracking-wide text-cream">
        {slot.label}
      </p>
      <p className="mt-1 text-[11px] text-sage">{slot.hint}</p>

      <div className="mt-3 grid h-32 place-items-center overflow-hidden rounded-lg border border-green-600 bg-green-900">
        {slot.src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={slot.src}
            alt={slot.label}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-[11px] text-sage">none uploaded</span>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="btn-gold mt-3 w-full py-2 text-xs"
      >
        {busy ? "Uploading…" : slot.src ? "Replace image" : "Upload image"}
      </button>

      {err && <p className="mt-2 text-[11px] text-red-300">{err}</p>}
      {ok && <p className="mt-2 text-[11px] text-emerald-300">Published. Live now.</p>}
    </div>
  );
}
