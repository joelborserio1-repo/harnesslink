import { getCategory, listArticles, type ArticleSummary } from "@/lib/api";
import AdSlot from "@/components/AdSlot";
import Hero from "@/components/home/Hero";
import EurekaPanel from "@/components/home/EurekaPanel";
import InsiderPanel from "@/components/home/InsiderPanel";
import TrendingTile from "@/components/home/TrendingTile";
import InternationalGrid from "@/components/home/InternationalGrid";
import WireList from "@/components/home/WireList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ articles }, top4, eureka] = await Promise.all([
    listArticles(1, 40),
    getCategory("top4"), // the editors' "Top 4" picks drive the lead stage, as on the live site
    getCategory("eureka"),
  ]);

  const heroSlides: ArticleSummary[] = (top4?.articles.length ? top4.articles : articles).slice(0, 4);
  const heroIds = new Set(heroSlides.map((a) => a.id));
  const rest = articles.filter((a) => !heroIds.has(a.id));

  const wire = articles.slice(0, 7);
  const trending = rest.slice(0, 3);
  const international = rest.slice(3);

  return (
    <div className="wrap py-6">
      {/* Row 1 — The Eureka · lead stories · The Insider, as on the live site. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)_minmax(0,290px)] lg:items-stretch">
        <div className="order-2 lg:order-1">
          <EurekaPanel stories={(eureka?.articles ?? []).slice(0, 3)} href="/category/eureka/" />
        </div>
        <div className="order-1 grid lg:order-2">
          <Hero slides={heroSlides} />
        </div>
        <div className="order-3">
          <InsiderPanel />
        </div>
      </div>

      <AdSlot size="leaderboard" zone="home-top" className="my-7" />

      <h1 className="border-y border-line bg-white py-4 text-center font-headline text-[28px] font-bold text-navy sm:text-[34px]">
        International Harness Racing Updates
      </h1>

      {/* Row 2 — main column + rail. */}
      <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <section className="sheet p-6">
            <div className="rule-head">
              <p className="kicker kicker-gold">Global coverage</p>
              <h2 className="font-headline mt-1 text-[26px] font-bold text-navy">Explore our Trending Stories</h2>
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-3">
              {trending.map((a, i) => (
                <TrendingTile key={a.id} article={a} rank={i + 1} />
              ))}
            </div>
          </section>

          <AdSlot size="leaderboard" zone="home-mid" />

          <section className="sheet p-6">
            <div className="rule-head">
              <h2 className="font-headline text-[26px] font-bold text-navy">Explore Our International Coverage</h2>
              <p className="mt-1.5 max-w-[68ch] text-[15px] leading-relaxed text-[#474b54]">
                The latest harness racing news, insight and features from Australia, New Zealand,
                North America and Europe, filed by our reporters at the track.
              </p>
            </div>
            <InternationalGrid articles={international} />
          </section>

          <AdSlot size="leaderboard" zone="home-bottom" />

          <section className="border-t border-line pt-5">
            <h2 className="font-headline text-xl font-bold text-navy">Harness racing news that feels close to the track</h2>
            <p className="mt-2 max-w-[78ch] text-sm leading-relaxed text-[#4a4f59]">
              Harnesslink brings you the latest standardbred news from Australia, New Zealand, the
              United States, Canada and Europe — race reports, driver and trainer features, breeding
              and sales coverage, and the form that matters. From Menangle and Albion Park to the
              Meadowlands, Addington and Gloucester Park, our reporters cover the meetings, the
              Group 1s and the stories behind the stables.
            </p>
          </section>
        </div>

        {/* Rail — the running news list, then the ad units. */}
        <aside className="flex flex-col gap-7 lg:sticky lg:top-4">
          <WireList articles={wire} />
          <AdSlot size="mpu" zone="home-rail-2" className="hidden lg:flex" />
          <AdSlot size="halfpage" zone="home-rail-3" className="hidden lg:flex" />
          <AdSlot size="mpu" zone="home-rail-mobile" className="lg:hidden" />
        </aside>
      </div>
    </div>
  );
}
