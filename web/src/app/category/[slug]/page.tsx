import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/api";
import ArchiveSection from "@/components/ArchiveSection";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategory(slug);
  if (!data) return {};
  return {
    title: data.category.name,
    description: `The latest ${data.category.name} harness racing news from Harnesslink.`,
    alternates: { canonical: `https://harnesslink.com/category/${data.category.slug}/` },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const data = await getCategory(slug);
  if (!data) notFound();

  return (
    <ArchiveSection
      eyebrow={data.category.kind === "geographic" ? "Country" : "Section"}
      title={data.category.name}
      subtitle={`The latest ${data.category.name} harness racing news, results and features.`}
      articles={data.articles}
    />
  );
}
