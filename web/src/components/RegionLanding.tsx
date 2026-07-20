import Link from "next/link";
import Thumb from "@/components/Thumb";
import ArticleTile from "@/components/home/ArticleTile";
import RegionNav from "@/components/RegionNav";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// A geographic-category landing page: an active-region nav, a lead hero story,
// a short secondary column, and a "Latest from {region}" grid of the rest.
// Falls back gracefully when the region has few (or no) articles.
export default function RegionLanding({
  name,
  slug,
  articles,
}: {
  name: string;
  slug: string;
  articles: ArticleSummary[];
}) {
  const [lead, ...rest] = articles;
  const secondary = rest.slice(0, 4);
  const latest = rest.slice(4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Region header + country switcher */}
      <div className="mb-6">
        <p className="eyebrow text-[15px]">Explore by Country</p>
        <h1 className="font-headline text-3xl font-extrabold text-navy sm:text-4xl">{name}</h1>
        <p className="mt-1.5 max-w-[64ch] text-[15px] text-[#41454e]">
          The latest {name} harness racing news, results and features from Harnesslink.
        </p>
        <div className="mt-4">
          <RegionNav activeSlug={slug} />
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="card p-8 text-neutral-500">No {name} stories yet — check back soon.</div>
      ) : (
        <>
          {/* Lead hero + secondary list */}
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <article className="card group overflow-hidden">
              <Link href={lead.url} className="relative block aspect-[16/9] overflow-hidden">
                <Thumb
                  image={lead.image}
                  seed={lead.id}
                  alt={lead.title}
                  sizes="(max-width: 1024px) 100vw, 720px"
                  className="transition duration-300 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 inline-flex items-center rounded bg-navy px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  {name}
                </span>
              </Link>
              <div className="p-5">
                <h2 className="font-headline text-2xl font-bold leading-tight text-navy [text-wrap:balance] group-hover:text-blue">
                  <Link href={lead.url}>{lead.title}</Link>
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  {lead.author && (
                    <span>
                      By <b className="font-semibold text-[#3a3f49]">{lead.author.name}</b>
                    </span>
                  )}
                  {lead.published_at && <span>· {formatCardDate(lead.published_at)}</span>}
                </div>
                {lead.excerpt && (
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4a4f59] line-clamp-3">{lead.excerpt}</p>
                )}
              </div>
            </article>

            {secondary.length > 0 && (
              <div className="card divide-y divide-black/[0.07] p-2">
                {secondary.map((a) => (
                  <article key={a.id} className="group flex gap-3 p-3">
                    <Link
                      href={a.url}
                      className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-md"
                    >
                      <Thumb image={a.image} seed={a.id} alt={a.title} sizes="96px" />
                    </Link>
                    <div className="min-w-0">
                      <h3 className="font-headline text-[15px] font-bold leading-[1.25] text-navy [text-wrap:balance] group-hover:text-blue">
                        <Link href={a.url}>{a.title}</Link>
                      </h3>
                      {a.published_at && (
                        <p className="mt-1 text-xs text-muted">{formatCardDate(a.published_at)}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Latest grid */}
          {latest.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 border-b-2 border-navy pb-2 font-headline text-xl font-extrabold text-navy">
                Latest from {name}
              </h2>
              <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
                {latest.map((a) => (
                  <ArticleTile key={a.id} article={a} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
