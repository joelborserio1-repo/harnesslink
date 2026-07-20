import Link from "next/link";
import type { ArticleSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="group border-b border-neutral-200 py-5">
      {article.category && (
        <Link
          href={article.category.url}
          className="text-xs font-bold uppercase tracking-wider text-accent"
        >
          {article.category.name}
        </Link>
      )}
      <h2 className="font-headline mt-1 text-xl font-bold leading-snug text-neutral-900">
        <Link href={article.url} className="group-hover:text-navy">
          {article.title}
        </Link>
      </h2>
      {article.excerpt && (
        <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{article.excerpt}</p>
      )}
      <div className="mt-2 text-xs text-neutral-500">
        {article.author && <span>By {article.author.name}</span>}
        {article.author && article.published_at && <span> · </span>}
        {article.published_at && <time>{formatDate(article.published_at)}</time>}
      </div>
    </article>
  );
}
