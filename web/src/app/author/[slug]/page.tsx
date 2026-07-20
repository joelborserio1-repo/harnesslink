import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getAuthor } from "@/lib/api";
import ArchiveSection from "@/components/ArchiveSection";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAuthor(slug);
  if (!data?.author) return {};
  return {
    title: data.author.name,
    description: `Articles by ${data.author.name} on Harnesslink.`,
    alternates: { canonical: `https://harnesslink.com/author/${data.author.slug}/` },
  };
}

export default async function AuthorPage({ params }: Params) {
  const { slug } = await params;
  const data = await getAuthor(slug);
  if (!data) notFound();
  if (data.redirect_to) permanentRedirect(data.redirect_to);
  if (!data.author) notFound();

  return (
    <ArchiveSection
      eyebrow="Contributor"
      title={data.author.name}
      subtitle={data.author.bio || data.author.role_title}
      articles={data.articles ?? []}
    />
  );
}
