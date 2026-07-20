import type { Metadata } from "next";
import Link from "next/link";
import { searchArticles } from "@/lib/api";
import ArticleTile from "@/components/home/ArticleTile";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : "Search",
    description: "Search Harnesslink harness racing news.",
    robots: { index: false }, // search results pages shouldn't be indexed
    alternates: { canonical: "https://harnesslink.com/search/" },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const { articles, total } = q ? await searchArticles(q, page) : { articles: [], total: 0 };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow text-[15px]">Search</p>
        <h1 className="font-headline text-3xl font-extrabold text-navy">Search Harnesslink</h1>

        <form action="/search/" className="mt-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search race reports, drivers, trainers…"
            className="w-full rounded-lg border border-black/15 px-4 py-2.5 text-[15px]"
          />
          <button className="shrink-0 rounded-lg bg-navy px-5 py-2.5 font-semibold text-white hover:bg-navy-deep">
            Search
          </button>
        </form>

        {q && (
          <p className="mt-4 text-sm text-muted">
            {total} result{total === 1 ? "" : "s"} for <b className="text-navy">“{q}”</b>
          </p>
        )}

        {q && articles.length === 0 ? (
          <p className="py-10 text-neutral-500">
            No stories matched. Try a driver, trainer, horse or track name.
          </p>
        ) : (
          <div className="mt-6 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleTile key={a.id} article={a} />
            ))}
          </div>
        )}

        {total > articles.length && (
          <div className="mt-8 flex justify-center gap-3">
            {page > 1 && (
              <Link href={`/search/?q=${encodeURIComponent(q)}&page=${page - 1}`} className="rounded border border-navy/20 px-4 py-2 text-sm font-semibold text-navy">
                ← Newer
              </Link>
            )}
            {page * 20 < total && (
              <Link href={`/search/?q=${encodeURIComponent(q)}&page=${page + 1}`} className="rounded border border-navy/20 px-4 py-2 text-sm font-semibold text-navy">
                Older →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
