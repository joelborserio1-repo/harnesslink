import Link from "next/link";
import { revalidatePath } from "next/cache";
import { listDirectoryListings, importDirectoryCsv } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminDirectory({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; imported?: string }>;
}) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  if (sp.type) params.type = sp.type;
  if (sp.q) params.q = sp.q;
  const { listings, types, total } = await listDirectoryListings(params);

  async function upload(formData: FormData) {
    "use server";
    const result = await importDirectoryCsv(formData);
    revalidatePath("/admin/directory");
    const flag = `imported=${result.created}+${result.updated}`;
    const { redirect } = await import("next/navigation");
    redirect(`/admin/directory?${flag}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Directory</h1>
        <span className="text-sm text-neutral-500">{total} listings</span>
      </div>

      {sp.imported && (
        <p className="mt-3 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          Import complete ({sp.imported.replace("+", " new, ")} updated).
        </p>
      )}

      {/* CSV import */}
      <form action={upload} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-neutral-500">CSV file</label>
          <input type="file" name="file" accept=".csv,text/csv" required className="mt-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-neutral-500">Into type</label>
          <select name="type" defaultValue="stallion" className="mt-1 rounded border border-neutral-300 px-2 py-1.5 text-sm">
            {types.map((t) => (
              <option key={t.key} value={t.key}>{t.plural}</option>
            ))}
          </select>
        </div>
        <button className="rounded bg-navy px-3 py-1.5 text-sm font-semibold text-white">Import CSV</button>
        <span className="text-xs text-neutral-400">Columns: name, stud, country, region, type, is_paying, email, phone, website, bio, race_record</span>
      </form>

      {/* Filter + new */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <form className="flex flex-wrap gap-2" action="/admin/directory">
          <input name="q" defaultValue={sp.q} placeholder="Search name / stud…" className="rounded border border-neutral-300 px-3 py-1.5 text-sm" />
          <select name="type" defaultValue={sp.type} className="rounded border border-neutral-300 px-3 py-1.5 text-sm">
            <option value="">any type</option>
            {types.map((t) => (
              <option key={t.key} value={t.key}>{t.plural}</option>
            ))}
          </select>
          <button className="rounded bg-neutral-800 px-3 py-1.5 text-sm font-semibold text-white">Filter</button>
        </form>
        <Link href="/admin/directory/new" className="rounded bg-navy px-3 py-1.5 text-sm font-semibold text-white">
          + New listing
        </Link>
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
            <th className="py-2">Country</th>
            <th className="py-2">Tier</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => (
            <tr key={l.id} className="border-b border-neutral-100">
              <td className="py-2 pr-3 font-semibold text-navy">{l.name}</td>
              <td className="py-2 pr-3 capitalize">{l.directory_type}</td>
              <td className="py-2 pr-3">{l.country}</td>
              <td className="py-2 pr-3">{l.is_paying ? "Paid" : "Free"}{l.is_featured ? " · Featured" : ""}</td>
              <td className="py-2 text-right">
                <Link href={`/admin/directory/${l.id}`} className="font-semibold text-blue hover:underline">Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
