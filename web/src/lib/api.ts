// Server-side content client: everything comes from the Strapi CMS
// (STRAPI_URL). Fetches run in React Server Components, so no browser CORS is
// involved.
import { blocksToHtml } from "@/lib/blocks";
import { previewHeaders } from "@/lib/preview";

const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");
// Where browsers load Strapi-hosted media from (the CMS's public address).
const MEDIA_BASE = (process.env.STRAPI_PUBLIC_URL || STRAPI_URL).replace(/\/$/, "");
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || "";
const REVALIDATE = 60; // pages regenerate at most once a minute
const SITE = "https://harnesslink.com";

export type Ref = { name: string; slug: string; url: string };

export type AuthorDetail = Ref & { bio: string | null; role_title: string | null };

export type Thumb = {
  src: string;
  srcset: string;
  sizes: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption?: string | null;
  credit?: string | null;
} | null;

export type ArticleSummary = {
  id: number;
  slug: string;
  url: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  published_at: string | null;
  category: Ref | null;
  categories: Ref[];
  image: Thumb;
  author: Ref | null;
};

export type ArticleSeo = {
  title: string;
  description: string | null;
  canonical_url: string;
  robots: string;
  og_title: string | null;
  og_description: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  schema_type: string;
};

export type ArticleFull = ArticleSummary & {
  document_id: string; // Strapi's id — comments are filed against it
  embed_html: string | null; // video/social embed added in the editor (oEmbed)
  body_format: "legacy_html" | "tiptap_json";
  body_html: string | null;
  body_json: Record<string, unknown>;
  modified_at: string | null;
  authors: AuthorDetail[];
  categories: Ref[];
  tags: Ref[];
  featured_image: Thumb;
  seo: ArticleSeo;
  related: ArticleSummary[];
  previous: { title: string; url: string } | null;
  next: { title: string; url: string } | null;
};

export type Category = { name: string; slug: string; kind: string; url: string };

export type StaticPage = {
  path: string;
  url: string;
  title: string;
  body_html: string | null;
  modified_at: string | null;
  seo: { title: string; description: string | null; canonical_url: string; robots: string };
};

export type AdCreative = {
  id: string; // the ad's Strapi documentId
  zone: string;
  size: string;
  image_url: string | null;
  width: number | null;
  height: number | null;
  html: string | null;
  alt: string;
  click_url: string;
};


// ---- Strapi plumbing ----

type Scalar = string | number | boolean;
type Query = { [key: string]: Query | Array<Query | Scalar> | Scalar | undefined };

// Strapi's bracketed query syntax: { filters: { slug: { $eq: "x" } } } →
// filters[slug][$eq]=x
function encode(q: Query, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) =>
        typeof item === "object" ? out.push(...encode(item, `${key}[${i}]`)) : out.push(`${key}[${i}]=${encodeURIComponent(String(item))}`)
      );
    } else if (typeof v === "object") {
      out.push(...encode(v, key));
    } else {
      out.push(`${key}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  // Fail-soft: never throw. `next build` succeeds without a running CMS, and
  // the site stays up (empty sections) if the CMS blips.
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE }, ...init });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function strapi<T>(path: string, query: Query = {}, init?: RequestInit): Promise<T | null> {
  const qs = encode(query).join("&");
  const headers: Record<string, string> = STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {};
  return fetchJson<T>(`${STRAPI_URL}/api${path}${qs ? `?${qs}` : ""}`, { headers, ...init });
}

type List<T> = { data: T[]; meta?: { pagination?: { total: number; page: number; pageSize: number } } };

// Raw Strapi shapes (only the fields we read).
type SMedia = {
  url: string;
  width?: number | null;
  height?: number | null;
  alternativeText?: string | null;
  caption?: string | null;
  formats?: Record<string, { url: string; width: number; height: number }> | null;
} | null;
type SLegacyImage = { url: string; width?: number | null; height?: number | null; alt?: string | null; caption?: string | null; credit?: string | null } | null;
type SRef = { name: string; slug: string };
type SAuthor = SRef & { bio?: string | null; roleTitle?: string | null };
type SSeo = {
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  schemaType?: string | null;
} | null;
type SArticle = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  excerpt?: string | null;
  bodyFormat?: "blocks" | "legacy_html";
  body?: unknown;
  bodyHtml?: string | null;
  publishDate?: string | null;
  modifiedDate?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  featuredImage?: SMedia;
  legacyImage?: SLegacyImage;
  primaryCategory?: SRef | null;
  categories?: SRef[];
  authors?: SAuthor[];
  tags?: SRef[];
  seo?: SSeo;
  embed?: string | { oembed?: { html?: string } } | null;
};

// The oEmbed field stores the provider's response as JSON; its `html` is the
// player (an iframe or the provider's blockquote + script).
function embedHtml(v: SArticle["embed"]): string | null {
  if (!v) return null;
  try {
    const data = typeof v === "string" ? JSON.parse(v) : v;
    return data?.oembed?.html || null;
  } catch {
    return null;
  }
}

const IMAGE_FIELDS = ["url", "width", "height", "alternativeText", "caption", "formats"];

const SUMMARY_QUERY: Query = {
  fields: ["title", "slug", "subtitle", "excerpt", "publishDate", "publishedAt"],
  populate: {
    featuredImage: { fields: IMAGE_FIELDS },
    legacyImage: { fields: ["url", "width", "height", "alt"] },
    primaryCategory: { fields: ["name", "slug"] },
    categories: { fields: ["name", "slug"] },
    authors: { fields: ["name", "slug"] },
  },
};

const media = (url: string) => (url.startsWith("http") ? url : `${MEDIA_BASE}${url}`);

function thumbFrom(a: { featuredImage?: SMedia; legacyImage?: SLegacyImage; title: string }): Thumb {
  const m = a.featuredImage;
  if (m?.url) {
    const formats = Object.values(m.formats || {}).sort((x, y) => x.width - y.width);
    return {
      src: media(m.url),
      srcset: [...formats.map((f) => `${media(f.url)} ${f.width}w`), ...(m.width ? [`${media(m.url)} ${m.width}w`] : [])].join(", "),
      sizes: "(max-width: 768px) 100vw, 800px",
      width: m.width ?? null,
      height: m.height ?? null,
      alt: m.alternativeText || a.title,
      caption: m.caption ?? null,
      credit: null,
    };
  }
  const l = a.legacyImage;
  if (l?.url) {
    return {
      src: l.url,
      srcset: "",
      sizes: "(max-width: 768px) 100vw, 800px",
      width: l.width ?? null,
      height: l.height ?? null,
      alt: l.alt || "",
      caption: l.caption ?? null,
      credit: l.credit ?? null,
    };
  }
  return null;
}

const catRef = (c?: SRef | null): Ref | null => (c ? { name: c.name, slug: c.slug, url: `/category/${c.slug}/` } : null);
const authorRef = (a?: SRef | null): Ref | null => (a ? { name: a.name, slug: a.slug, url: `/writers/${a.slug}/` } : null);

function summary(a: SArticle): ArticleSummary {
  return {
    id: a.id,
    slug: a.slug,
    url: `/${a.slug}/`,
    title: a.title,
    subtitle: a.subtitle ?? null,
    excerpt: a.excerpt ?? null,
    published_at: a.publishDate ?? a.publishedAt ?? null,
    category: catRef(a.primaryCategory),
    categories: (a.categories || []).map((c) => catRef(c)!),
    image: thumbFrom(a),
    author: authorRef((a.authors || [])[0]),
  };
}

const NEWEST: Query = { sort: ["publishDate:desc", "publishedAt:desc"] };

async function articleList(filters: Query | undefined, page: number, perPage: number) {
  const data = await strapi<List<SArticle>>("/articles", {
    ...SUMMARY_QUERY,
    ...NEWEST,
    ...(filters ? { filters } : {}),
    pagination: { page, pageSize: perPage },
  });
  return {
    articles: (data?.data || []).map(summary),
    total: data?.meta?.pagination?.total ?? 0,
  };
}

// ---- Articles ----

export async function listArticles(page = 1, perPage = 12) {
  const { articles, total } = await articleList(undefined, page, perPage);
  return { articles, total, page };
}

// The Story editor saves pasted videos as <oembed url="…">, which browsers
// ignore: YouTube and Vimeo become players, anything else a plain link.
function videoPlayer(url: string): string {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `<iframe src="https://player.vimeo.com/video/${vimeo[1]}" title="Video" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  return `<a href="${url}">${url}</a>`;
}

// Story HTML from the Story editor: photos point at the CMS's own /uploads/
// (the page needs the CMS's public address in front), videos need players.
function withMediaBase(html: string | null): string | null {
  if (!html) return html;
  return html
    .replace(/((?:src|href|srcset)=["']|,\s*)\/uploads\//g, `$1${MEDIA_BASE}/uploads/`)
    .replace(/<oembed url="([^"]+)"><\/oembed>/g, (_, url: string) =>
      /^https?:\/\//.test(url) ? `<div class="article-embed">${videoPlayer(url.replace(/&amp;/g, "&"))}</div>` : ""
    );
}

// Draft (preview) reads go to the CMS's preview route with the shared secret
// and are never cached.
const draftInit = (draft: boolean): RequestInit | undefined =>
  draft ? { headers: previewHeaders(), cache: "no-store", next: undefined } : undefined;

export async function getArticle(slug: string, { draft = false } = {}): Promise<ArticleFull | null> {
  const data = await strapi<List<SArticle>>(draft ? "/preview/articles" : "/articles", {
    filters: { slug: { $eq: slug } },
    populate: {
      featuredImage: { fields: IMAGE_FIELDS },
      legacyImage: "*",
      primaryCategory: { fields: ["name", "slug"] },
      categories: { fields: ["name", "slug"] },
      authors: { fields: ["name", "slug", "bio", "roleTitle"] },
      tags: { fields: ["name", "slug"] },
      seo: "*",
    },
    pagination: { pageSize: 1 },
  }, draftInit(draft));
  const a = data?.data?.[0];
  if (!a) return null;

  const published = a.publishDate ?? a.publishedAt ?? null;
  const [related, previous, next] = await Promise.all([
    articleList(
      {
        slug: { $ne: a.slug },
        ...(a.primaryCategory ? { primaryCategory: { slug: { $eq: a.primaryCategory.slug } } } : {}),
      },
      1,
      6
    ),
    published ? neighbour(a.slug, published, "older") : null,
    published ? neighbour(a.slug, published, "newer") : null,
  ]);

  const seo = a.seo || {};
  const canonical = seo.canonicalUrl || `${SITE}/${a.slug}/`;
  const bodyHtml = a.bodyFormat === "blocks" ? blocksToHtml(a.body, MEDIA_BASE) : withMediaBase(a.bodyHtml ?? null);

  return {
    ...summary(a),
    document_id: a.documentId,
    embed_html: embedHtml(a.embed),
    body_format: a.bodyFormat === "blocks" ? "tiptap_json" : "legacy_html",
    body_html: bodyHtml,
    body_json: {},
    modified_at: a.modifiedDate ?? a.updatedAt ?? published,
    authors: (a.authors || []).map((x) => ({
      name: x.name,
      slug: x.slug,
      url: `/writers/${x.slug}/`,
      bio: x.bio ?? null,
      role_title: x.roleTitle ?? null,
    })),
    tags: (a.tags || []).map((t) => ({ name: t.name, slug: t.slug, url: `/tag/${t.slug}/` })),
    featured_image: thumbFrom(a),
    seo: {
      title: seo.metaTitle || `${a.title} - Harnesslink`,
      description: seo.metaDescription ?? a.excerpt ?? null,
      canonical_url: canonical,
      robots: seo.robots || "index,follow",
      og_title: seo.ogTitle || seo.metaTitle || a.title,
      og_description: seo.ogDescription || seo.metaDescription || null,
      twitter_title: seo.twitterTitle ?? null,
      twitter_description: seo.twitterDescription ?? null,
      schema_type: seo.schemaType || "NewsArticle",
    },
    related: related.articles,
    previous,
    next,
  };
}

// The story published just before / after (the live site's Previous / Next).
async function neighbour(slug: string, published: string, direction: "older" | "newer") {
  const data = await strapi<List<SArticle>>("/articles", {
    fields: ["title", "slug"],
    filters: { slug: { $ne: slug }, publishDate: direction === "older" ? { $lt: published } : { $gt: published } },
    sort: [direction === "older" ? "publishDate:desc" : "publishDate:asc"],
    pagination: { pageSize: 1 },
  });
  const n = data?.data?.[0];
  return n ? { title: n.title, url: `/${n.slug}/` } : null;
}

// ---- Sections, writers, tags ----

type SCategory = { name: string; slug: string; kind: string };

export async function listCategories(): Promise<Category[]> {
  const data = await strapi<List<SCategory>>("/categories", {
    fields: ["name", "slug", "kind"],
    sort: ["position:asc", "name:asc"],
    pagination: { pageSize: 100 },
  });
  return (data?.data || []).map((c) => ({ name: c.name, slug: c.slug, kind: c.kind, url: `/category/${c.slug}/` }));
}

export async function getCategory(slug: string) {
  const data = await strapi<List<SCategory>>("/categories", {
    fields: ["name", "slug", "kind"],
    filters: { slug: { $eq: slug } },
    pagination: { pageSize: 1 },
  });
  const c = data?.data?.[0];
  if (!c) return null;
  const { articles } = await articleList({ categories: { slug: { $eq: slug } } }, 1, 24);
  return { category: { name: c.name, slug: c.slug, kind: c.kind, url: `/category/${c.slug}/` }, articles };
}

// Site search runs on Meilisearch (typo-tolerant, ranked, newest first among
// equals). Without MEILI_HOST it falls back to a plain title/excerpt match in
// Strapi. The key never reaches the browser: this runs on the server.
const MEILI_HOST = (process.env.MEILI_HOST || "").replace(/\/$/, "");
const MEILI_KEY = process.env.MEILI_SEARCH_KEY || process.env.MEILI_MASTER_KEY || "";

type MeiliHit = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  authors: string[];
  authorSlugs?: string[];
  category: string;
  categorySlug: string;
  image: string;
  publishDate: string | null;
};

function hitToSummary(h: MeiliHit): ArticleSummary {
  const category = h.categorySlug ? { name: h.category, slug: h.categorySlug, url: `/category/${h.categorySlug}/` } : null;
  const authorSlug = h.authorSlugs?.[0];
  const author = h.authors?.[0] && authorSlug ? { name: h.authors[0], slug: authorSlug, url: `/writers/${authorSlug}/` } : null;
  return {
    id: h.id,
    slug: h.slug,
    url: `/${h.slug}/`,
    title: h.title,
    subtitle: h.subtitle || null,
    excerpt: h.excerpt || null,
    published_at: h.publishDate,
    category,
    categories: category ? [category] : [],
    image: { src: h.image ? media(h.image) : "", srcset: "", sizes: "", width: null, height: null, alt: h.title },
    author,
  };
}

export async function searchArticles(q: string, page = 1) {
  if (!q || q.trim().length < 2) return { query: q, articles: [] as ArticleSummary[], total: 0, page };
  const term = q.trim();
  const perPage = 20;

  if (MEILI_HOST) {
    try {
      const res = await fetch(`${MEILI_HOST}/indexes/articles/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${MEILI_KEY}` },
        body: JSON.stringify({ q: term, page, hitsPerPage: perPage }),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as { hits: MeiliHit[]; totalHits: number };
        return { query: q, articles: data.hits.map(hitToSummary), total: data.totalHits, page };
      }
    } catch {
      // fall through to the database search
    }
  }

  const { articles, total } = await articleList(
    { $or: [{ title: { $containsi: term } }, { excerpt: { $containsi: term } }] },
    page,
    perPage
  );
  return { query: q, articles, total, page };
}

export async function getAuthor(slug: string) {
  const data = await strapi<List<SAuthor>>("/authors", {
    fields: ["name", "slug", "bio", "roleTitle"],
    filters: { slug: { $eq: slug } },
    pagination: { pageSize: 1 },
  });
  const a = data?.data?.[0];
  if (!a) return null;
  const { articles } = await articleList({ authors: { slug: { $eq: slug } } }, 1, 24);
  return {
    author: { name: a.name, slug: a.slug, bio: a.bio ?? null, role_title: a.roleTitle ?? null, url: `/writers/${a.slug}/` },
    articles,
    redirect_to: undefined as string | undefined,
  };
}

export async function getTag(slug: string) {
  const data = await strapi<List<SRef>>("/tags", {
    fields: ["name", "slug"],
    filters: { slug: { $eq: slug } },
    pagination: { pageSize: 1 },
  });
  const t = data?.data?.[0];
  if (!t) return null;
  const { articles } = await articleList({ tags: { slug: { $eq: slug } } }, 1, 24);
  return { tag: { name: t.name, slug: t.slug, url: `/tag/${t.slug}/` }, articles };
}

// ---- Static pages ----

type SPage = {
  title: string;
  path: string;
  bodyFormat?: "blocks" | "legacy_html";
  body?: unknown;
  bodyHtml?: string | null;
  modifiedDate?: string | null;
  updatedAt?: string | null;
  seo?: SSeo;
};

export async function getPage(path: string, { draft = false } = {}): Promise<StaticPage | null> {
  const clean = path.split("/").filter(Boolean).join("/");
  const data = await strapi<List<SPage>>(draft ? "/preview/pages" : "/pages", {
    filters: { path: { $eq: clean } },
    populate: { seo: "*" },
    pagination: { pageSize: 1 },
  }, draftInit(draft));
  const p = data?.data?.[0];
  if (!p) return null;
  const seo = p.seo || {};
  return {
    path: p.path,
    url: `/${p.path}/`,
    title: p.title,
    body_html: p.bodyFormat === "blocks" ? blocksToHtml(p.body, MEDIA_BASE) : withMediaBase(p.bodyHtml ?? null),
    modified_at: p.modifiedDate ?? p.updatedAt ?? null,
    seo: {
      title: seo.metaTitle || `${p.title} - Harnesslink`,
      description: seo.metaDescription ?? null,
      canonical_url: seo.canonicalUrl || `${SITE}/${p.path}/`,
      robots: seo.robots || "index,follow",
    },
  };
}

// ---- Sitemaps & feed (lean listings from the CMS) ----

export type SitemapArticle = { slug: string; title: string; publishDate: string | null; lastmod: string | null };

export async function sitemapArticles(page: number, perPage: number, since?: string) {
  return (
    (await strapi<{ total: number; articles: SitemapArticle[] }>(
      "/sitemap/articles",
      { page, perPage, ...(since ? { since } : {}) },
      { next: { revalidate: 300 } }
    )) ?? { total: 0, articles: [] }
  );
}

export async function sitemapArchives() {
  return (
    (await strapi<{ categories: string[]; countries: string[]; pages: string[]; writers: string[]; tags: string[] }>(
      "/sitemap/archives",
      {},
      { next: { revalidate: 300 } }
    )) ?? { categories: [], countries: [], pages: [], writers: [], tags: [] }
  );
}

// ---- Ads ----

// Zone → creatives for every booked zone (rails carry up to three). Fetched
// once per request (Next dedupes the fetch across all AdSlots on a page).
// Ads booked for the reader's country (two-letter code; empty = unknown, which
// only gets ads with no country ticked or "everywhere else").
export async function getAds(country = ""): Promise<Record<string, AdCreative[]>> {
  const data = await strapi<{ ads: Record<string, AdCreative[]> }>(
    "/ads/live",
    country ? { country } : {},
    { next: { revalidate: 60 } }
  );
  return data?.ads ?? {};
}

// ---- Directory (Strapi's public directory routes; contact details only on
// paid listings) ----

async function get<T>(path: string): Promise<T | null> {
  return strapi<T>(path.replace(/^\/api\/v1/, ""));
}


export type DirectoryType = {
  key: string;
  url: string;
  singular: string;
  plural: string;
  org_label: string;
  supports_gait?: boolean;
  count: number;
};

export type DirectoryListingSummary = {
  id: number;
  slug: string;
  name: string;
  directory_type: string;
  type_label: string;
  org_label: string;
  stud_name: string | null;
  country: string | null;
  region: string | null;
  gait: string | null;
  is_paying: boolean;
  is_featured: boolean;
  profile_image: string | null;
  path: string;
};

export type DirectoryProgenyRow = {
  name: string;
  foaling_date: string | null;
  country: string | null;
  sex: string | null;
  dam: string | null;
  broodmare_sire: string | null;
  prizemoney: string | null;
  mile_rate: string | null;
  starts: number;
  wins: number;
};

export type DirectoryListingFull = DirectoryListingSummary & {
  stud_master: string | null;
  suburb: string | null;
  industry: string | null;
  coverage: string | null;
  status_note: string | null;
  profile_bio: string | null;
  race_record: string | null;
  service_fee: string | null;
  progeny_note: string | null;
  progeny: DirectoryProgenyRow[];
  tagline?: string | null;
  short_summary?: string | null;
  year_of_birth?: string | null;
  colour?: string | null;
  sex?: string | null;
  career_earnings?: string | null;
  hero_image?: string | null;
  booking?: { url: string; label: string } | null;
  pedigree?: Partial<Record<"sire" | "dam" | "ss" | "sd" | "ds" | "dd" | "sss" | "ssd" | "sds" | "sdd" | "dss" | "dsd" | "dds" | "ddd", string | null>> | null;
  crosses_intro?: string | null;
  crosses?: { title: string; description: string | null; examples: string | null }[];
  gallery?: { media_type: "image" | "video"; url: string; caption: string | null; description: string | null }[];
  related?: DirectoryListingSummary[];
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    stud_website?: string;
    address?: string;
    au?: string;
    nz?: string;
    us?: string;
    fr?: string;
    other?: string;
  };
};

export async function getDirectoryHub() {
  const data = await get<{ types: DirectoryType[]; total: number }>(`/api/v1/directory`);
  return data ?? { types: [], total: 0 };
}

export async function getDirectoryType(typeUrl: string, country?: string) {
  const q = country ? `?country=${encodeURIComponent(country)}` : "";
  return get<{
    type: Omit<DirectoryType, "count">;
    countries: string[];
    listings: DirectoryListingSummary[];
  }>(`/api/v1/directory/${encodeURIComponent(typeUrl)}${q}`);
}

export async function getDirectoryListing(typeUrl: string, id: string) {
  const data = await get<{ listing: DirectoryListingFull }>(
    `/api/v1/directory/${encodeURIComponent(typeUrl)}/${encodeURIComponent(id)}`
  );
  return data?.listing ?? null;
}

