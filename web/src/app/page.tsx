import { Fragment } from "react";
import Link from "next/link";
import { listArticles } from "@/lib/api";
import ArticleCard from "@/components/ArticleCard";
import AdSlot from "@/components/AdSlot";
import { formatDate } from "@/lib/format";

export const revalidate = 60;

export default async function HomePage() {
  const { articles } = await listArticles(1, 20);
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Top leaderboard ad location */}
      <AdSlot size="leaderboard" zone="home-top" className="mb-8" />

      {lead && (
        <section className="mb-8 border-b border-neutral-200 pb-8">
          {lead.category && (
            <Link
              href={lead.category.url}
              className="text-xs font-bold uppercase tracking-wider text-accent"
            >
              {lead.category.name}
            </Link>
          )}
          <h1 className="font-headline mt-2 text-5xl font-extrabold leading-tight tracking-tight text-navy">
            <Link href={lead.url} className="hover:text-accent">
              {lead.title}
            </Link>
          </h1>
          {lead.excerpt && <p className="mt-3 text-lg text-neutral-600">{lead.excerpt}</p>}
          <div className="mt-3 text-sm text-neutral-500">
            {lead.author && <span>By {lead.author.name}</span>}
            {lead.author && lead.published_at && <span> · </span>}
            {lead.published_at && <time>{formatDate(lead.published_at)}</time>}
          </div>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          {rest.map((a, i) => (
            <Fragment key={a.id}>
              <ArticleCard article={a} />
              {i === 5 && (
                <AdSlot size="leaderboard" zone="home-infeed" className="my-6" />
              )}
            </Fragment>
          ))}
        </div>

        {/* Sidebar ad rail */}
        <aside className="lg:col-span-1">
          <div className="sticky top-4 space-y-8">
            <AdSlot size="mpu" zone="home-sidebar-1" />
            <div className="rounded border border-neutral-200 p-4">
              <h2 className="font-headline text-lg font-bold text-navy">The Insider</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Our weekly subscriber briefing — form, features and analysis.
              </p>
              <Link
                href="/"
                className="mt-3 inline-block rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Subscribe
              </Link>
            </div>
            <AdSlot size="halfpage" zone="home-sidebar-2" />
          </div>
        </aside>
      </div>
    </div>
  );
}
