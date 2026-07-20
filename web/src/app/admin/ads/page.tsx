import Link from "next/link";
import { listAds } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminAds() {
  const { ads } = await listAds();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Ad Manager</h1>
        <Link href="/admin/ads/new" className="rounded bg-navy px-3 py-1.5 text-sm font-semibold text-white">
          + New ad
        </Link>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Name</th>
            <th className="py-2">Zone</th>
            <th className="py-2">Status</th>
            <th className="py-2">Weight</th>
            <th className="py-2">Clicks</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {ads.map((a) => (
            <tr key={a.id} className="border-b border-neutral-100">
              <td className="py-2 pr-3 font-semibold text-navy">{a.name}</td>
              <td className="py-2 pr-3 font-mono text-xs">{a.zone}</td>
              <td className="py-2 pr-3">{a.is_active ? "Active" : "Paused"}</td>
              <td className="py-2 pr-3">{a.weight}</td>
              <td className="py-2 pr-3">{a.clicks}</td>
              <td className="py-2 text-right">
                <Link href={`/admin/ads/${a.id}`} className="font-semibold text-blue hover:underline">Edit</Link>
              </td>
            </tr>
          ))}
          {ads.length === 0 && (
            <tr><td colSpan={6} className="py-8 text-center text-neutral-400">No ads yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
