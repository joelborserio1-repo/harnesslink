import { SITE_URL, pageSocial } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/api";
import ArchiveSection from "@/components/ArchiveSection";
import RegionLanding from "@/components/RegionLanding";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategory(slug);
  if (!data) return {};
  const geo = data.category.kind === "geographic";
  // Title as on the live site ("USA - Harnesslink") until after cutover; a
  // more descriptive one ("USA Harness Racing News") is planned once rankings
  // have settled.
  const description = geo
    ? `${data.category.name} harness racing news, results and features — updated daily by Harnesslink.`
    : `The latest ${data.category.name} harness racing news from Harnesslink.`;
  const url = `${SITE_URL}/category/${data.category.slug}/`;
  return {
    title: data.category.name,
    description,
    alternates: { canonical: url },
    ...pageSocial({ title: `${data.category.name} - Harnesslink`, description, url }),
  };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const data = await getCategory(slug);
  if (!data) notFound();

  // Geographic categories (AUS, NZ, USA, CA, Europe, …) get the richer regional
  // landing template; editorial categories keep the simple archive layout.
  if (data.category.kind === "geographic") {
    return (
      <RegionLanding
        name={data.category.name}
        slug={data.category.slug}
        articles={data.articles}
      />
    );
  }

  return (
    <ArchiveSection
      eyebrow="Section"
      title={data.category.name}
      subtitle={`The latest ${data.category.name} harness racing news, results and features.`}
      articles={data.articles}
    />
  );
}
