import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTag } from "@/lib/api";
import ArchiveSection from "@/components/ArchiveSection";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTag(slug);
  if (!data) return {};
  return {
    title: data.tag.name,
    description: `${data.tag.name} — harness racing news and results from Harnesslink.`,
    alternates: { canonical: `https://harnesslink.com/tag/${data.tag.slug}/` },
  };
}

export default async function TagPage({ params }: Params) {
  const { slug } = await params;
  const data = await getTag(slug);
  if (!data) notFound();

  return <ArchiveSection eyebrow="Tag" title={data.tag.name} articles={data.articles} />;
}
