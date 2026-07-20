import Link from "next/link";
import { listArticles } from "@/lib/api";
import ArticleCard from "@/components/ArticleCard";
import { formatDate } from "@/lib/format";

export const revalidate = 60;

export default async function HomePage() {
  const { articles } = await listArticles(1, 20);
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {lead && (
        <section className="mb-8 border-b border-neutral-200 pb-8">
          {lead.category && (
            <Link
              href={lead.category.url}
              className="text-xs font-bold uppercase tracking-wider text-red-600"
            >
              {lead.category.name}
            </Link>
          )}
          <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight text-neutral-900">
            <Link href={lead.url} className="hover:text-red-700">
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

      <div className="grid gap-x-10 md:grid-cols-2">
        <div>
          {rest.slice(0, Math.ceil(rest.length / 2)).map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
        <div>
          {rest.slice(Math.ceil(rest.length / 2)).map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
