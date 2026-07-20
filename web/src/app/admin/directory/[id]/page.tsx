import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  getDirectoryListingAdmin,
  saveDirectoryListing,
  deleteDirectoryListing,
  listDirectoryListings,
  type AdminDirectoryListing,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

const TEXT_FIELDS: [keyof AdminDirectoryListing, string][] = [
  ["name", "Name"],
  ["stud_name", "Stud / organisation"],
  ["country", "Country"],
  ["region", "Region"],
  ["race_record", "Race record"],
  ["service_fee", "Service fee"],
  ["contact_phone", "Phone"],
  ["contact_email", "Email"],
  ["contact_website", "Website"],
];

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  const listing = isNew ? null : await getDirectoryListingAdmin(id);
  if (!isNew && !listing) notFound();
  const { types } = await listDirectoryListings();

  async function save(formData: FormData) {
    "use server";
    const body: Record<string, unknown> = {
      directory_type: formData.get("directory_type"),
      name: formData.get("name"),
      stud_name: formData.get("stud_name"),
      country: formData.get("country"),
      region: formData.get("region"),
      gait: formData.get("gait"),
      race_record: formData.get("race_record"),
      service_fee: formData.get("service_fee"),
      contact_phone: formData.get("contact_phone"),
      contact_email: formData.get("contact_email"),
      contact_website: formData.get("contact_website"),
      contact_address: formData.get("contact_address"),
      profile_bio: formData.get("profile_bio"),
      progeny_note: formData.get("progeny_note"),
      is_paying: formData.get("is_paying") === "on",
      is_featured: formData.get("is_featured") === "on",
    };
    const ok = await saveDirectoryListing(isNew ? null : id, body);
    if (ok) {
      revalidatePath("/admin/directory");
      redirect("/admin/directory");
    }
  }

  async function remove() {
    "use server";
    await deleteDirectoryListing(id);
    revalidatePath("/admin/directory");
    redirect("/admin/directory");
  }

  const v = (k: keyof AdminDirectoryListing) => (listing?.[k] as string | undefined) ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin/directory" className="text-sm text-blue hover:underline">← Directory</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">{isNew ? "New listing" : `Edit — ${listing?.name}`}</h1>

      <form action={save} className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <label className="block text-sm font-semibold text-neutral-700">
          Type
          <select name="directory_type" defaultValue={listing?.directory_type ?? "stallion"}
                  className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal">
            {types.map((t) => <option key={t.key} value={t.key}>{t.plural}</option>)}
          </select>
        </label>

        {TEXT_FIELDS.map(([key, label]) => (
          <label key={key} className="block text-sm font-semibold text-neutral-700">
            {label}
            <input name={key} defaultValue={v(key)}
                   className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
          </label>
        ))}

        <label className="block text-sm font-semibold text-neutral-700">
          Gait
          <select name="gait" defaultValue={listing?.gait ?? "Pacer"}
                  className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal">
            <option>Pacer</option>
            <option>Trotter</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Bio
          <textarea name="profile_bio" defaultValue={v("profile_bio")} rows={4}
                    className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-neutral-700">
          Progeny note
          <textarea name="progeny_note" defaultValue={v("progeny_note")} rows={2}
                    className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>
        <label className="block text-sm font-semibold text-neutral-700">
          Address
          <textarea name="contact_address" defaultValue={v("contact_address")} rows={2}
                    className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="is_paying" defaultChecked={listing?.is_paying} /> Paid (shows contact)
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="is_featured" defaultChecked={listing?.is_featured} /> Featured
          </label>
        </div>

        <button className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>

      {!isNew && (
        <form action={remove} className="mt-4">
          <button className="text-sm font-semibold text-red-600 hover:underline">Delete listing</button>
        </form>
      )}
    </div>
  );
}
