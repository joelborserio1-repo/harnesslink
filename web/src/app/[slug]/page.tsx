import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, listArticles, type ArticleFull } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Breadcrumbs, { type Crumb } from "@/components/article/Breadcrumbs";
import AuthorBox from "@/components/article/AuthorBox";
import ArticleSidebar from "@/components/article/ArticleSidebar";
import ViewBeacon from "@/components/article/ViewBeacon";
import AdSlot from "@/components/AdSlot";
import ArticleTile from "@/components/home/ArticleTile";

// SSR per request on staging (no build-time API dependency). For production,
// switch to ISR: `export const revalidate = 60` + a generateStaticParams that
// pre-renders known slugs once builds run against a live API.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

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
      images: article.featured_image?.src ? [{ url: article.featured_image.src }] : undefined,
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
    image: article.featured_image?.src ? [article.featured_image.src] : undefined,
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  // "Most Read" widget — recent stories, excluding this one.
  const { articles: recent } = await listArticles(1, 6);
  const mostRead = recent.filter((a) => a.slug !== article.slug).slice(0, 5);

  const crumbs: Crumb[] = [
    { name: "Home", url: "/" },
    ...(article.category ? [{ name: article.category.name, url: article.category.url }] : []),
    { name: article.title, url: article.url },
  ];

  return (
    <div className="mx-auto my-8 max-w-6xl px-4">
      <ViewBeacon slug={article.slug} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-3">
            <Breadcrumbs items={crumbs} />
          </div>

          <article className="card p-6 sm:p-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd(article)) }}
        />

        {article.category && (
          <Link
            href={article.category.url}
            className="text-xs font-bold uppercase tracking-wider text-accent"
          >
            {article.category.name}
          </Link>
        )}

        <h1 className="font-headline mt-2 text-5xl font-extrabold leading-tight tracking-tight text-navy-deep">
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
                <Link href={a.url} className="font-semibold text-neutral-700 hover:text-accent">
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

      {article.featured_image?.src && (
        <figure className="mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.featured_image.src}
            srcSet={article.featured_image.srcset}
            sizes="(max-width: 768px) 100vw, 768px"
            alt={article.featured_image.alt || article.title}
            width={article.featured_image.width ?? undefined}
            height={article.featured_image.height ?? undefined}
            className="w-full rounded"
          />
          {(article.featured_image.caption || article.featured_image.credit) && (
            <figcaption className="mt-2 text-sm text-neutral-500">
              {article.featured_image.caption}
              {article.featured_image.credit && (
                <span className="italic"> — {article.featured_image.credit}</span>
              )}
            </figcaption>
          )}
        </figure>
      )}

      {/* Legacy WP HTML is preserved verbatim; TipTap articles store their
          rendered HTML in body_html at save time — both render the same way. */}
      {article.body_html ? (
        <div
          className="prose-article mt-6"
          dangerouslySetInnerHTML={{ __html: article.body_html }}
        />
      ) : (
        <div className="prose-article mt-6">
          <p className="text-neutral-500">(No content yet.)</p>
        </div>
      )}

        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-neutral-200 pt-6">
            {article.tags.map((t) => (
              <Link
                key={t.slug}
                href={t.url}
                className="rounded-full bg-page px-3 py-1 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {article.authors[0] && <AuthorBox author={article.authors[0]} />}
      </article>

          {article.related.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 border-b-2 border-navy pb-2 font-headline text-xl font-extrabold text-navy">
                More {article.category ? `from ${article.category.name}` : "harness racing news"}
              </h2>
              <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
                {article.related.slice(0, 6).map((a) => (
                  <ArticleTile key={a.id} article={a} />
                ))}
              </div>
            </section>
          )}

          {/* Mobile: one in-flow ad below the article (sidebar is desktop-only) */}
          <div className="mt-8 lg:hidden">
            <AdSlot size="mpu" zone="article-mobile" />
          </div>
        </div>

        <ArticleSidebar mostRead={mostRead} />
      </div>
    </div>
  );
}
