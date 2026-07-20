import { listArticles, getCategory } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import AdSlot from "@/components/AdSlot";
import Hero from "@/components/home/Hero";
import TrendingTile from "@/components/home/TrendingTile";
import InternationalGrid from "@/components/home/InternationalGrid";
import CountryRail, { type RegionBlock } from "@/components/home/CountryRail";
import NextToGo from "@/components/home/NextToGo";
import InsiderPanel from "@/components/home/InsiderPanel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Recent feed for the hero/trending/international, plus the five country
  // sections fetched in parallel for the "Racing by Country" rail.
  const [{ articles }, regions] = await Promise.all([
    listArticles(1, 20),
    Promise.all(
      COUNTRIES.map(async (country): Promise<RegionBlock> => {
        const data = await getCategory(country.slug);
        return { country, articles: data?.articles ?? [] };
      })
    ),
  ]);
  const heroSlides = articles.slice(0, 4);
  const trending = articles.slice(4, 7);
  const international = articles.slice(4);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6">
      <div className="grid gap-[26px] lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ============ MAIN COLUMN ============ */}
        <div className="flex min-w-0 flex-col gap-6">
          <Hero slides={heroSlides} />

          {/* Mobile: Next To Go sits directly under the hero */}
          <div className="lg:hidden">
            <NextToGo />
          </div>

          <AdSlot size="leaderboard" zone="home-top" />

          <section className="card p-6">
            <p className="eyebrow text-[15px]">Trending Now</p>
            <h2 className="font-headline text-[26px] font-bold text-navy [text-wrap:balance]">Explore our Trending Stories</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {trending.map((a) => (
                <TrendingTile key={a.id} article={a} />
              ))}
            </div>
          </section>

          <section className="card p-6">
            <p className="eyebrow text-[15px]">Explore by Country</p>
            <h2 className="font-headline text-[26px] font-bold text-navy [text-wrap:balance]">Racing by Country</h2>
            <p className="mt-1 max-w-[64ch] text-[15px] text-[#41454e]">
              The latest from harness racing&apos;s major regions — Australia, New Zealand, the USA,
              Canada and Europe.
            </p>
            <CountryRail regions={regions} />
          </section>

          <AdSlot size="leaderboard" zone="home-mid" />

          <section className="card p-6">
            <p className="eyebrow text-[15px]">Global Coverage</p>
            <h2 className="font-headline text-[26px] font-bold text-navy [text-wrap:balance]">Explore Our International Coverage</h2>
            <p className="mt-1 max-w-[64ch] text-[15px] text-[#41454e]">
              Results, features and analysis from the world&apos;s harness racing hubs — the Inter
              Dominion in Australia, the Grand Circuit across North America, and the classics of New
              Zealand and Europe, filed by our team on the ground.
            </p>
            <InternationalGrid articles={international} />
          </section>

          <section className="card p-6">
            <h2 className="font-headline text-xl font-bold text-navy">Harness racing&apos;s global news source</h2>
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-[#4a4f59]">
              Harnesslink brings you the latest standardbred news from Australia, New Zealand, the
              United States, Canada and Europe — race reports, driver and trainer features, breeding
              and sales coverage, and the form that matters. From Menangle and Albion Park to the
              Meadowlands, Addington and Gloucester Park, our reporters cover the meetings, the
              Group 1s and the stories behind the stables.
            </p>
          </section>

          <AdSlot size="leaderboard" zone="home-bottom" />
        </div>

        {/* ============ STICKY RIGHT RAIL (desktop) ============ */}
        <aside className="hidden flex-col gap-5 self-start lg:sticky lg:top-4 lg:flex">
          <InsiderPanel />
          <AdSlot size="mpu" zone="home-rail-1" />
          <NextToGo />
          <AdSlot size="mpu" zone="home-rail-2" />
          <AdSlot size="halfpage" zone="home-rail-3" />
        </aside>
      </div>

      {/* Mobile: the rest of the rail (Insider + ad) below the main column */}
      <div className="mt-6 flex flex-col gap-5 lg:hidden">
        <InsiderPanel />
        <AdSlot size="mpu" zone="home-rail-mobile" />
      </div>
    </div>
  );
}
