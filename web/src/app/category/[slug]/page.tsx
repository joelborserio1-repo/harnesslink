import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/api";
import ArticleCard from "@/components/ArticleCard";

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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-headline border-b-2 border-accent pb-2 text-4xl font-extrabold tracking-tight text-navy-deep">
        {data.category.name}
      </h1>
      <div className="mt-2">
        {data.articles.length === 0 && (
          <p className="py-8 text-neutral-500">No articles yet.</p>
        )}
        {data.articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </div>
  );
}
