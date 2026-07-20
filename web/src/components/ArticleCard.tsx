import Link from "next/link";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

const PALETTES = [
  ["#0e2a6b", "#1b3f8f"],
  ["#0f5f63", "#12857f"],
  ["#334155", "#475569"],
  ["#3b2a5e", "#5b3f8f"],
  ["#7c2d12", "#b45309"],
];

// Branded gradient stand-in until the importer supplies real featured images.
function PlaceholderThumb({ seed }: { seed: number }) {
  const [a, b] = PALETTES[seed % PALETTES.length];
  const id = `g${seed}`;
  return (
    <svg viewBox="0 0 800 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill={`url(#${id})`} />
      <text x="400" y="270" textAnchor="middle" fontFamily="Georgia, serif" fontSize="52" fill="#ffffff" fillOpacity="0.14" letterSpacing="8">
        HARNESSLINK
      </text>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  const badge =
    article.categories.length > 0
      ? article.categories.map((c) => c.name).join(", ")
      : article.category?.name;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <Link href={article.url} className="relative block aspect-[16/10] overflow-hidden bg-navy">
        {article.image?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image.src}
            srcSet={article.image.srcset}
            sizes="(max-width: 640px) 100vw, 400px"
            alt={article.image.alt || article.title}
            width={article.image.width ?? undefined}
            height={article.image.height ?? undefined}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <PlaceholderThumb seed={article.id} />
        )}
        {badge && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            <GlobeIcon />
            {badge}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-headline text-2xl font-bold leading-tight text-neutral-900">
          <Link href={article.url} className="group-hover:text-accent">
            {article.title}
          </Link>
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {article.author && (
            <span className="flex items-center gap-1.5">
              <PersonIcon />
              {article.author.name}
            </span>
          )}
          {article.published_at && (
            <span className="flex items-center gap-1.5">
              <ClockIcon />
              {formatCardDate(article.published_at)}
            </span>
          )}
        </div>

        {article.excerpt && (
          <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-neutral-600">
            {article.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}
