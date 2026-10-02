import Link from "next/link";
import Thumb from "@/components/Thumb";
import Kicker from "@/components/Kicker";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// Standard story tile: photograph, section kicker, serif headline, byline, and
// an optional standfirst. Used by every grid on the site.
export default function ArticleTile({
  article,
  excerpt = true,
  size = "md",
}: {
  article: ArticleSummary;
  excerpt?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <article className="group flex flex-col">
      <Link href={article.url} className="block aspect-[3/2] overflow-hidden bg-mist" tabIndex={-1} aria-hidden>
        <Thumb
          image={article.image}
          seed={article.id}
          alt=""
          sizes="(max-width: 640px) 100vw, 420px"
          className="transition duration-500 group-hover:scale-[1.03]"
        />
      </Link>
      <Kicker category={article.category} className="mt-3" />
      <h3
        className={`font-headline mt-1.5 font-bold text-navy [text-wrap:balance] ${
          size === "lg" ? "text-[26px] leading-[1.15]" : "text-[19px] leading-[1.22]"
        }`}
      >
        <Link href={article.url} className="hl-link">
          {article.title}
        </Link>
      </h3>
      <p className="meta mt-2">
        {article.author && <>By <b>{article.author.name}</b> · </>}
        {article.published_at && <time dateTime={article.published_at}>{formatCardDate(article.published_at)}</time>}
      </p>
      {excerpt && article.excerpt && (
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#474b54] line-clamp-3">{article.excerpt}</p>
      )}
    </article>
  );
}
