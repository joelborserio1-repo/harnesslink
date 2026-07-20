import { listArticles } from "@/lib/api";
import AdSlot from "@/components/AdSlot";
import Hero from "@/components/home/Hero";
import TrendingTile from "@/components/home/TrendingTile";
import InternationalGrid from "@/components/home/InternationalGrid";
import NextToGo from "@/components/home/NextToGo";
import InsiderPanel from "@/components/home/InsiderPanel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { articles } = await listArticles(1, 20);
  const heroSlides = articles.slice(0, 4);
  const trending = articles.slice(4, 7);
  const international = articles.slice(4);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6">
      {/* Top band — a 2-col / 2-row grid so the rail lines up with the main
          column: Hero (featured) ↔ Insider on row 1, Trending ↔ Next To Go on
          row 2. Grid rows top-align across columns, so it stays aligned
          regardless of each block's own height. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <Hero slides={heroSlides} />
        <InsiderPanel />

        <section className="card min-w-0 p-6">
          <p className="eyebrow text-[15px]">Trending Now</p>
          <h2 className="font-headline text-[26px] font-bold text-navy [text-wrap:balance]">
            Explore our Trending Stories
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {trending.map((a) => (
              <TrendingTile key={a.id} article={a} />
            ))}
          </div>
        </section>
        <NextToGo />
      </div>

      {/* Rest of the page — main content plus a slimmer sticky ad rail. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <AdSlot size="leaderboard" zone="home-top" />

          <section className="card p-6">
            <p className="eyebrow text-[15px]">Global Coverage</p>
            <h2 className="font-headline text-[26px] font-bold text-navy [text-wrap:balance]">
              Explore Our International Coverage
            </h2>
            <p className="mt-1 max-w-[64ch] text-[15px] text-[#41454e]">
              Results, features and analysis from the world&apos;s harness racing hubs — the Inter
              Dominion in Australia, the Grand Circuit across North America, and the classics of New
              Zealand and Europe, filed by our team on the ground.
            </p>
            <InternationalGrid articles={international} />
          </section>

          <AdSlot size="leaderboard" zone="home-mid" />

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

        {/* Sticky ad rail (desktop). The Insider + Next To Go blocks moved up
            into the aligned top band, so this carries the ad units only. */}
        <aside className="hidden flex-col gap-6 self-start lg:sticky lg:top-4 lg:flex">
          <AdSlot size="mpu" zone="home-rail-2" />
          <AdSlot size="halfpage" zone="home-rail-3" />
        </aside>
      </div>

      {/* Mobile: one rail ad below everything */}
      <div className="mt-6 flex flex-col gap-5 lg:hidden">
        <AdSlot size="mpu" zone="home-rail-mobile" />
      </div>
    </div>
  );
}
