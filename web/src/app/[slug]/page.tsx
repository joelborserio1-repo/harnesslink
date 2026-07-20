import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, listArticles, type ArticleFull } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

// Pre-render the known article paths at build; others render on demand (ISR).
export async function generateStaticParams() {
  const { articles } = await listArticles(1, 50);
  return articles.map((a) => ({ slug: a.slug }));
}

function robotsFrom(value: string) {
  const tokens = value.split(",").map((t) => t.trim().toLowerCase());
  return { index: !tokens.includes("noindex"), follow: !tokens.includes("nofollow") };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  const { seo } = article;
  return {
    title: article.title, // the layout template appends "| Harnesslink"
    description: seo.description ?? undefined,
    alternates: { canonical: seo.canonical_url },
    robots: robotsFrom(seo.robots),
    openGraph: {
      type: "article",
      title: seo.og_title ?? article.title,
      description: seo.og_description ?? seo.description ?? undefined,
      url: seo.canonical_url,
      siteName: "Harnesslink",
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.modified_at ?? undefined,
      authors: article.authors.map((a) => a.name),
      section: article.category?.name,
      images: article.featured_image?.url ? [{ url: article.featured_image.url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.twitter_title ?? seo.og_title ?? article.title,
      description: seo.twitter_description ?? seo.description ?? undefined,
    },
  };
}

function newsArticleJsonLd(article: ArticleFull) {
  return {
    "@context": "https://schema.org",
    "@type": article.seo.schema_type || "NewsArticle",
    headline: article.title,
    datePublished: article.published_at,
    dateModified: article.modified_at ?? article.published_at,
    author: article.authors.map((a) => ({
      "@type": "Person",
      name: a.name,
      url: `https://harnesslink.com${a.url}`,
    })),
    publisher: {
      "@type": "Organization",
      name: "Harnesslink",
      logo: {
        "@type": "ImageObject",
        url: "https://harnesslink.com/logo.png",
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": article.seo.canonical_url },
    articleSection: article.category?.name,
    image: article.featured_image?.url ? [article.featured_image.url] : undefined,
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd(article)) }}
      />

      {article.category && (
        <Link
          href={article.category.url}
          className="text-xs font-bold uppercase tracking-wider text-red-600"
        >
          {article.category.name}
        </Link>
      )}

      <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight text-neutral-900">
        {article.title}
      </h1>
      {article.subtitle && (
        <p className="mt-3 text-xl text-neutral-600">{article.subtitle}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-2 border-b border-neutral-200 pb-4 text-sm text-neutral-500">
        {article.authors.length > 0 && (
          <span>
            By{" "}
            {article.authors.map((a, i) => (
              <span key={a.slug}>
                {i > 0 && ", "}
                <Link href={a.url} className="font-semibold text-neutral-700 hover:text-red-600">
                  {a.name}
                </Link>
              </span>
            ))}
          </span>
        )}
        {article.published_at && (
          <>
            <span>·</span>
            <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
          </>
        )}
      </div>

      {/* Legacy WordPress HTML is rendered verbatim (sanitised at import time). */}
      {article.body_format === "legacy_html" ? (
        <div
          className="prose-article mt-6"
          dangerouslySetInnerHTML={{ __html: article.body_html ?? "" }}
        />
      ) : (
        <div className="prose-article mt-6">
          <p className="text-neutral-500">
            (TipTap-rendered content — renderer for new articles comes later.)
          </p>
        </div>
      )}
    </article>
  );
}
