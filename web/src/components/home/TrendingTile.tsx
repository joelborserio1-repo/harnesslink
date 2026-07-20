import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

export default function TrendingTile({ article }: { article: ArticleSummary }) {
  return (
    <article className="group flex flex-col gap-2">
      <Link href={article.url} className="block aspect-[16/10] overflow-hidden rounded-[9px] shadow-[0_1px_4px_rgba(8,31,91,0.12)]">
        <Thumb image={article.image} seed={article.id + 100} alt={article.title} sizes="(max-width: 1024px) 100vw, 240px" className="transition duration-300 group-hover:scale-105" />
      </Link>
      <h3 className="font-headline text-base font-bold leading-tight text-navy [text-wrap:balance] group-hover:text-blue">
        <Link href={article.url}>{article.title}</Link>
      </h3>
      {article.published_at && <div className="text-xs text-muted">{formatCardDate(article.published_at)}</div>}
    </article>
  );
}
