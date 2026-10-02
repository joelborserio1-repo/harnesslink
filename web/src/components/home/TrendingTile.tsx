import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// Numbered trending story — the rank is set in the serif as a typographic
// device, not a badge.
export default function TrendingTile({ article, rank }: { article: ArticleSummary; rank: number }) {
  return (
    <article className="group flex flex-col">
      <Link href={article.url} className="block aspect-[3/2] overflow-hidden bg-mist" tabIndex={-1} aria-hidden>
        <Thumb
          image={article.image}
          seed={article.id + 100}
          alt=""
          sizes="(max-width: 640px) 100vw, 260px"
          className="transition duration-500 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="mt-3 flex gap-3">
        <span className="font-headline text-[30px] font-bold leading-none text-navy/25" aria-hidden>
          {rank}
        </span>
        <div>
          <h3 className="font-headline text-[17px] font-bold leading-[1.22] text-navy [text-wrap:balance]">
            <Link href={article.url} className="hl-link">
              {article.title}
            </Link>
          </h3>
          {article.published_at && <p className="meta mt-1.5">{formatCardDate(article.published_at)}</p>}
        </div>
      </div>
    </article>
  );
}
