import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdAdmin, saveAd, deleteAd, listAds } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function EditAd({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  const ad = isNew ? null : await getAdAdmin(id);
  if (!isNew && !ad) notFound();
  const { zones } = await listAds();

  async function save(formData: FormData) {
    "use server";
    const body: Record<string, unknown> = {
      name: formData.get("name"),
      zone: formData.get("zone"),
      image_url: formData.get("image_url"),
      link_url: formData.get("link_url"),
      alt: formData.get("alt"),
      html: formData.get("html"),
      weight: Number(formData.get("weight") || 1),
      is_active: formData.get("is_active") === "on",
      starts_at: formData.get("starts_at") || null,
      ends_at: formData.get("ends_at") || null,
    };
    const ok = await saveAd(isNew ? null : id, body);
    if (ok) {
      revalidatePath("/admin/ads");
      redirect("/admin/ads");
    }
  }

  async function remove() {
    "use server";
    await deleteAd(id);
    revalidatePath("/admin/ads");
    redirect("/admin/ads");
  }

  const dt = (v: string | null) => (v ? v.slice(0, 16) : "");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin/ads" className="text-sm text-blue hover:underline">← Ad Manager</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">{isNew ? "New ad" : `Edit — ${ad?.name}`}</h1>

      <form action={save} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <label className="block text-sm font-semibold text-neutral-700">
          Name
          <input name="name" defaultValue={ad?.name ?? ""} required
                 className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Zone (placement)
          <select name="zone" defaultValue={ad?.zone ?? zones[0]?.key}
                  className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal">
            {zones.map((z) => <option key={z.key} value={z.key}>{z.label} — {z.size}</option>)}
          </select>
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Image URL (creative)
          <input name="image_url" defaultValue={ad?.image_url ?? ""} placeholder="https://… or data:…"
                 className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-neutral-700">
          Click-through URL
          <input name="link_url" defaultValue={ad?.link_url ?? ""} placeholder="https://advertiser.example"
                 className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-neutral-700">
          Alt text
          <input name="alt" defaultValue={ad?.alt ?? ""}
                 className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-neutral-700">
          HTML creative (optional — overrides image)
          <textarea name="html" defaultValue={ad?.html ?? ""} rows={3}
                    className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs font-normal" />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-semibold text-neutral-700">
            Weight
            <input type="number" name="weight" min={1} defaultValue={ad?.weight ?? 1}
                   className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-neutral-700">
            <input type="checkbox" name="is_active" defaultChecked={ad?.is_active ?? true} /> Active
          </label>
          <label className="block text-sm font-semibold text-neutral-700">
            Starts at
            <input type="datetime-local" name="starts_at" defaultValue={dt(ad?.starts_at ?? null)}
                   className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-neutral-700">
            Ends at
            <input type="datetime-local" name="ends_at" defaultValue={dt(ad?.ends_at ?? null)}
                   className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
          </label>
        </div>

        {!isNew && ad && (
          <p className="text-xs text-neutral-400">{ad.impressions} impressions · {ad.clicks} clicks</p>
        )}

        <button className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>

      {!isNew && (
        <form action={remove} className="mt-4">
          <button className="text-sm font-semibold text-red-600 hover:underline">Delete ad</button>
        </form>
      )}
    </div>
  );
}
