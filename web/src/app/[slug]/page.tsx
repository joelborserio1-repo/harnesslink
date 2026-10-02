import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, getPage, listArticles, type ArticleFull } from "@/lib/api";
import StaticPageView from "@/components/StaticPageView";
import { formatDate, formatTime } from "@/lib/format";
import Breadcrumbs, { type Crumb } from "@/components/article/Breadcrumbs";
import AuthorBox from "@/components/article/AuthorBox";
import ArticleSidebar from "@/components/article/ArticleSidebar";
import ViewBeacon from "@/components/article/ViewBeacon";
import RegistrationWall from "@/components/article/RegistrationWall";
import AdSlot from "@/components/AdSlot";
import ArticleTile from "@/components/home/ArticleTile";
import ShareLinks from "@/components/article/ShareLinks";

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
  if (!article) {
    // Articles and pages share the root namespace on WordPress; a slug that is
    // not an article may be a migrated static page.
    const page = await getPage(slug);
    if (!page) return {};
    return {
      title: { absolute: page.seo.title },
      description: page.seo.description ?? undefined,
      alternates: { canonical: page.seo.canonical_url },
      robots: robotsFrom(page.seo.robots),
    };
  }

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
  if (!article) {
    const page = await getPage(slug);
    if (!page) notFound();
    return <StaticPageView page={page} />;
  }

  // "Most Read" widget — recent stories, excluding this one.
  const { articles: recent } = await listArticles(1, 6);
  const mostRead = recent.filter((a) => a.slug !== article.slug).slice(0, 5);

  const crumbs: Crumb[] = [
    { name: "Home", url: "/" },
    ...(article.category ? [{ name: article.category.name, url: article.category.url }] : []),
    { name: article.title, url: article.url },
  ];

  // The live site prints the photograph inside the body, not above it. Only add
  // the featured image as a lead figure when the body has no image of its own,
  // so legacy stories keep the same image count they have today.
  const bodyHasImage = /<img\b/i.test(article.body_html ?? "");
  const lead = !bodyHasImage ? article.featured_image : null;

  return (
    <div className="wrap my-7">
      <ViewBeacon slug={article.slug} />
      <RegistrationWall slug={article.slug} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          <article className="sheet px-5 py-7 sm:px-10 sm:py-9">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd(article)) }}
            />

            <AdSlot size="leaderboard" zone="article-top" className="mb-7" />

            <div className="mx-auto max-w-[720px]">
              <Breadcrumbs items={crumbs} />

              <h1 className="font-headline mt-4 text-[34px] font-bold leading-[1.1] text-navy-deep [text-wrap:balance] sm:text-[46px]">
                {article.title}
              </h1>
              {article.subtitle && (
                <p className="mt-3 text-[20px] leading-snug text-[#4a4e57]">{article.subtitle}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-line py-3">
                <p className="meta">
                  {article.authors.length > 0 && (
                    <>
                      By{" "}
                      {article.authors.map((a, i) => (
                        <span key={a.slug}>
                          {i > 0 && ", "}
                          <Link href={a.url} className="font-bold text-navy hover:text-blue">
                            {a.name}
                          </Link>
                        </span>
                      ))}
                      {" · "}
                    </>
                  )}
                  {article.published_at && (
                    <time dateTime={article.published_at}>
                      {formatDate(article.published_at)} · {formatTime(article.published_at)}
                    </time>
                  )}
                </p>
                <ShareLinks url={article.seo.canonical_url} title={article.title} />
              </div>

              {lead?.src && (
                <figure className="mt-7">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lead.src}
                    srcSet={lead.srcset}
                    sizes="(max-width: 768px) 100vw, 720px"
                    alt={lead.alt || article.title}
                    width={lead.width ?? undefined}
                    height={lead.height ?? undefined}
                    fetchPriority="high"
                    className="w-full"
                  />
                  {(lead.caption || lead.credit) && (
                    <figcaption className="mt-2 border-l-2 border-navy pl-2.5 text-[13px] text-muted">
                      {lead.caption}
                      {lead.credit && <span> ({lead.credit})</span>}
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Legacy WP HTML is preserved verbatim; TipTap articles store their
                  rendered HTML in body_html at save time — both render the same way. */}
              {article.body_html ? (
                <div
                  className="prose-article mt-7"
                  dangerouslySetInnerHTML={{ __html: article.body_html }}
                />
              ) : (
                <div className="prose-article mt-7">
                  <p className="text-neutral-500">(No content yet.)</p>
                </div>
              )}

              {/* Filed under — plain text links, as on the live site. */}
              <dl className="mt-9 grid gap-x-8 gap-y-4 border-t border-line pt-5 text-[14px] sm:grid-cols-[auto_1fr]">
                {article.categories.length > 0 && (
                  <>
                    <dt className="kicker pt-0.5">Categories</dt>
                    <dd>
                      {article.categories.map((c, i) => (
                        <span key={c.slug}>
                          {i > 0 && ", "}
                          <Link href={c.url} className="text-navy underline-offset-2 hover:underline">
                            {c.name}
                          </Link>
                        </span>
                      ))}
                    </dd>
                  </>
                )}
                {article.tags.length > 0 && (
                  <>
                    <dt className="kicker pt-0.5">Tags</dt>
                    <dd>
                      {article.tags.map((t, i) => (
                        <span key={t.slug}>
                          {i > 0 && ", "}
                          <Link href={t.url} className="text-navy underline-offset-2 hover:underline">
                            {t.name}
                          </Link>
                        </span>
                      ))}
                    </dd>
                  </>
                )}
              </dl>

              {article.authors[0] && <AuthorBox author={article.authors[0]} />}

              {(article.previous || article.next) && (
                <nav aria-label="More stories" className="mt-9 grid border-y border-line sm:grid-cols-2">
                  <div className="py-4 sm:pr-6">
                    {article.previous && (
                      <Link href={article.previous.url} className="group block">
                        <span className="kicker">← Previous</span>
                        <span className="font-headline mt-1 block text-[16px] font-bold leading-snug text-navy">
                          <span className="hl-link">{article.previous.title}</span>
                        </span>
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-line py-4 sm:border-l sm:border-t-0 sm:pl-6 sm:text-right">
                    {article.next && (
                      <Link href={article.next.url} className="group block">
                        <span className="kicker">Next →</span>
                        <span className="font-headline mt-1 block text-[16px] font-bold leading-snug text-navy">
                          <span className="hl-link">{article.next.title}</span>
                        </span>
                      </Link>
                    )}
                  </div>
                </nav>
              )}
            </div>
          </article>

          {article.related.length > 0 && (
            <section className="sheet mt-7 p-6">
              <h2 className="rule-head font-headline text-[22px] font-bold text-navy">
                More {article.category ? `from ${article.category.name}` : "harness racing news"}
              </h2>
              <div className="mt-5 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {article.related.slice(0, 6).map((a) => (
                  <ArticleTile key={a.id} article={a} excerpt={false} />
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
