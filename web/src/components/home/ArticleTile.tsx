import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// International-grid tile: image + country chip, serif headline, byline, excerpt.
export default function ArticleTile({ article }: { article: ArticleSummary }) {
  const country = article.category?.name;
  return (
    <article className="group flex flex-col gap-2.5">
      <Link href={article.url} className="relative block aspect-[16/9] overflow-hidden rounded-[10px] shadow-[0_1px_5px_rgba(8,31,91,0.13)]">
        <Thumb image={article.image} seed={article.id} alt={article.title} sizes="(max-width: 1024px) 100vw, 380px" className="transition duration-300 group-hover:scale-105" />
        {country && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-[2px]">
            {country}
          </span>
        )}
      </Link>
      <h3 className="font-headline text-[19px] font-bold leading-[1.22] text-navy [text-wrap:balance] group-hover:text-blue">
        <Link href={article.url}>{article.title}</Link>
      </h3>
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        {article.author && <span>By <b className="font-semibold text-[#3a3f49]">{article.author.name}</b></span>}
        {article.published_at && <span>· {formatCardDate(article.published_at)}</span>}
      </div>
      {article.excerpt && <p className="text-sm leading-relaxed text-[#4a4f59] line-clamp-2">{article.excerpt}</p>}
    </article>
  );
}
