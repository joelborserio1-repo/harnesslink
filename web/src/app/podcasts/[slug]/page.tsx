import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { getPage } from "@/lib/api";
import StaticPageView from "@/components/StaticPageView";
import PreviewBanner from "@/components/PreviewBanner";
import { pageSocial, robotsFrom } from "@/lib/seo";

// One episode of The Final Qtr, at the same /podcasts/<slug>/ address as the
// old WordPress site. Episodes are Pages in the CMS with path podcasts/<slug>
// (cms/scripts/import-podcasts.js); new ones can be added the same way.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { isEnabled: draft } = await draftMode();
  const page = await getPage(`podcasts/${slug}`, { draft });
  if (!page) return {};
  return {
    title: { absolute: page.seo.title },
    description: page.seo.description ?? undefined,
    alternates: { canonical: page.seo.canonical_url },
    robots: draft ? { index: false, follow: false } : robotsFrom(page.seo.robots),
    ...pageSocial({ title: page.seo.title, description: page.seo.description, url: page.seo.canonical_url }),
  };
}

export default async function PodcastEpisode({ params }: Params) {
  const { slug } = await params;
  const { isEnabled: draft } = await draftMode();
  const page = await getPage(`podcasts/${slug}`, { draft });
  if (!page) notFound();
  return (
    <>
      {draft && <PreviewBanner path={`/podcasts/${slug}/`} />}
      <StaticPageView page={page} />
    </>
  );
}
