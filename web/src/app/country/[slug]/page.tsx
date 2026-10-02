import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/api";
import { isCountrySlug } from "@/lib/countries";
import RegionLanding from "@/components/RegionLanding";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

// /country/{slug}/ — the country archives the live navigation links to. Same
// stories as the matching geographic category, at the URL that ranks today.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isCountrySlug(slug)) return {};
  const data = await getCategory(slug);
  if (!data) return {};
  return {
    title: `${data.category.name} Harness Racing News`,
    description: `${data.category.name} harness racing news, results and features — updated daily by Harnesslink.`,
    alternates: { canonical: `https://harnesslink.com/country/${data.category.slug}/` },
  };
}

export default async function CountryPage({ params }: Params) {
  const { slug } = await params;
  if (!isCountrySlug(slug)) notFound();
  const data = await getCategory(slug);
  if (!data) notFound();

  return <RegionLanding name={data.category.name} slug={data.category.slug} articles={data.articles} />;
}
