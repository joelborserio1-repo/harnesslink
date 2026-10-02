import Link from "next/link";
import { listArticles, getAdminStats, getMe, canPublish } from "@/lib/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["", "published", "draft", "in_review", "scheduled", "archived"];
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "Awaiting review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <div className="font-headline text-2xl font-bold text-navy">{value.toLocaleString()}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="border border-neutral-200 bg-white p-4 hover:border-navy">{inner}</Link>
  ) : (
    <div className="border border-neutral-200 bg-white p-4">{inner}</div>
  );
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; needs_review?: string; q?: string; mine?: string }>;
}) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  if (sp.status) params.status = sp.status;
  if (sp.needs_review) params.needs_review = sp.needs_review;
  if (sp.q) params.q = sp.q;
  if (sp.mine) params.mine = sp.mine;
  const [me, { articles, total }, stats] = await Promise.all([getMe(), listArticles(params), getAdminStats()]);
  const desk = canPublish(me);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {stats && desk && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Awaiting review" value={stats.in_review} href="/admin/?status=in_review" />
          <Stat label="Published" value={stats.published} href="/admin/?status=published" />
          <Stat label="Import flags" value={stats.needs_review} href="/admin/?needs_review=true" />
          <Stat label="Total views" value={stats.total_views} />
          <Stat label="Subscribers" value={stats.subscribers} />
          <Stat label="Live ads" value={stats.active_ads} />
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h1 className="font-headline text-2xl font-bold text-navy">
          {desk ? (sp.status === "in_review" ? "Review queue" : "Stories") : "My stories"}
        </h1>
        <span className="text-sm text-neutral-500">{total.toLocaleString()} total</span>
      </div>
      {!desk && (
        <p className="mt-1 text-sm text-neutral-600">
          File a story as a draft, then set it to “Awaiting review” to send it to the desk. An
          editor publishes it.
        </p>
      )}

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/admin/">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search headline…"
          className="border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <select name="status" defaultValue={sp.status} className="border border-neutral-300 px-3 py-1.5 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? STATUS_LABEL[s] : "Any status"}</option>
          ))}
        </select>
        {desk && (
          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            <input type="checkbox" name="mine" value="true" defaultChecked={sp.mine === "true"} />
            Filed by me
          </label>
        )}
        <button className="bg-navy px-3 py-1.5 text-sm font-semibold text-white">Filter</button>
      </form>

      {articles.length === 0 ? (
        <p className="mt-8 border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          {desk ? "No stories match." : "You haven't filed a story yet."}{" "}
          <Link href="/admin/articles/new/" className="font-semibold text-navy underline underline-offset-2">
            Start a new story
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2">Headline</th>
                <th className="py-2">Status</th>
                <th className="py-2">Section</th>
                <th className="py-2">Byline</th>
                {desk && <th className="py-2">Filed by</th>}
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-b border-neutral-200 align-top">
                  <td className="py-2.5 pr-3">
                    <Link href={`/admin/articles/${a.id}/`} className="font-semibold text-navy hover:underline">
                      {a.title}
                    </Link>
                    {a.needs_review && (
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-accent">
                        Import flag{a.import_flags.length ? `: ${a.import_flags.join(", ")}` : ""}
                      </span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap py-2.5 pr-3 ${a.status === "in_review" ? "font-semibold text-red" : "text-neutral-600"}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </td>
                  <td className="py-2.5 pr-3 text-neutral-600">{a.primary_category ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-neutral-600">{a.authors.join(", ") || "—"}</td>
                  {desk && <td className="py-2.5 text-neutral-600">{a.created_by ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
