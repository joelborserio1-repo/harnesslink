import Link from "next/link";
import Thumb from "@/components/Thumb";
import ArticleTile from "@/components/home/ArticleTile";
import RegionNav from "@/components/RegionNav";
import AdSlot from "@/components/AdSlot";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// A geographic-category landing page: the country switcher, a lead story set
// wide, then the three-across grid the live country pages use — with the ad
// rail alongside. Falls back gracefully when the region has few (or no) stories.
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

  return (
    <div className="wrap py-7">
      <header className="mb-6">
        <p className="kicker kicker-gold">Explore by country</p>
        <h1 className="font-headline mt-1 text-[40px] font-bold leading-none text-navy sm:text-[52px]">{name}</h1>
        <p className="mt-3 max-w-[64ch] text-[15px] text-[#474b54]">
          The latest {name} harness racing news, results and features from Harnesslink.
        </p>
        <div className="mt-5">
          <RegionNav activeSlug={slug} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          {articles.length === 0 ? (
            <div className="sheet p-8 text-neutral-500">No {name} stories yet — check back soon.</div>
          ) : (
            <div className="sheet p-6">
              <article className="group grid gap-6 border-b border-line pb-7 md:grid-cols-[1.35fr_1fr] md:items-center">
                <Link href={lead.url} className="block aspect-[3/2] overflow-hidden bg-mist" tabIndex={-1} aria-hidden>
                  <Thumb
                    image={lead.image}
                    seed={lead.id}
                    alt=""
                    sizes="(max-width: 768px) 100vw, 520px"
                    eager
                    className="transition duration-500 group-hover:scale-[1.03]"
                  />
                </Link>
                <div>
                  <p className="kicker kicker-gold">Latest</p>
                  <h2 className="font-headline mt-2 text-[30px] font-bold leading-[1.12] text-navy [text-wrap:balance]">
                    <Link href={lead.url} className="hl-link">
                      {lead.title}
                    </Link>
                  </h2>
                  <p className="meta mt-3">
                    {lead.author && <>By <b>{lead.author.name}</b> · </>}
                    {lead.published_at && <time dateTime={lead.published_at}>{formatCardDate(lead.published_at)}</time>}
                  </p>
                  {lead.excerpt && (
                    <p className="mt-3 text-[15.5px] leading-relaxed text-[#474b54] line-clamp-4">{lead.excerpt}</p>
                  )}
                </div>
              </article>

              {rest.length > 0 && (
                <div className="mt-7 grid gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
                  {rest.map((a) => (
                    <ArticleTile key={a.id} article={a} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Three stacked 300 × 250 boxes, as on the live archive pages; below
            the stories on phones. */}
        <aside className="flex flex-col gap-7">
          <AdSlot format="mpu" zone="archive-rail" />
        </aside>
      </div>
    </div>
  );
}
