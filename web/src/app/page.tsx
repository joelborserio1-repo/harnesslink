import { Fragment } from "react";
import { listArticles } from "@/lib/api";
import ArticleCard from "@/components/ArticleCard";
import AdSlot from "@/components/AdSlot";

// SSR per request on staging so content is always live (no build-time API
// dependency). Switch to ISR (export const revalidate = 60) for production once
// the importer has populated content and builds run against a live API.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { articles } = await listArticles(1, 20);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Top leaderboard ad location */}
      <AdSlot size="leaderboard" zone="home-top" className="mb-8" />

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <Fragment key={a.id}>
            <ArticleCard article={a} />
            {/* In-feed banner spanning the full row */}
            {i === 5 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <AdSlot size="billboard" zone="home-infeed" className="my-2" />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
