import Link from "next/link";
import { listArticles, getAdminStats } from "@/lib/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["", "published", "draft", "in_review", "scheduled", "archived"];

const ADMIN_NAV = [
  { href: "/admin", label: "Articles" },
  { href: "/admin/directory", label: "Directory" },
  { href: "/admin/ads", label: "Ads" },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-2xl font-extrabold text-navy">{value.toLocaleString()}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; needs_review?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  if (sp.status) params.status = sp.status;
  if (sp.needs_review) params.needs_review = sp.needs_review;
  if (sp.q) params.q = sp.q;
  const [{ articles, total }, stats] = await Promise.all([listArticles(params), getAdminStats()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Admin section nav + Avo link */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {ADMIN_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-neutral-200">
            {n.label}
          </Link>
        ))}
        <a href="/avo" className="rounded-full border border-navy/20 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white">
          Full admin (Avo) ↗
        </a>
      </div>

      {/* Dashboard stats */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Published" value={stats.published} />
          <Stat label="Total views" value={stats.total_views} />
          <Stat label="Subscribers" value={stats.subscribers} />
          <Stat label="Needs review" value={stats.needs_review} />
          <Stat label="Listings" value={stats.listings} />
          <Stat label="Live ads" value={stats.active_ads} />
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Articles</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{total} total</span>
          <Link href="/admin/articles/new" className="rounded bg-navy px-3 py-1.5 text-sm font-semibold text-white">
            + New article
          </Link>
        </div>
      </div>

      <form className="mt-4 flex flex-wrap gap-2" action="/admin">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search title…"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <select name="status" defaultValue={sp.status} className="rounded border border-neutral-300 px-3 py-1.5 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || "any status"}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" name="needs_review" value="true" defaultChecked={sp.needs_review === "true"} />
          needs review
        </label>
        <button className="rounded bg-navy px-3 py-1.5 text-sm font-semibold text-white">Filter</button>
      </form>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Title</th>
            <th className="py-2">Status</th>
            <th className="py-2">Category</th>
            <th className="py-2">Byline</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id} className="border-b border-neutral-100">
              <td className="py-2 pr-3">
                <Link href={`/admin/articles/${a.id}`} className="font-semibold text-navy hover:text-accent">
                  {a.title}
                </Link>
                {a.needs_review && (
                  <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                    review{a.import_flags.length ? `: ${a.import_flags.join(",")}` : ""}
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 text-neutral-600">{a.status}</td>
              <td className="py-2 pr-3 text-neutral-600">{a.primary_category ?? "—"}</td>
              <td className="py-2 pr-3 text-neutral-600">{a.authors.join(", ") || "—"}</td>
              <td className="py-2 text-right">
                <Link href={`/admin/articles/${a.id}`} className="text-sm font-semibold text-accent">Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
