// Server-side API client for the Rails backend. Fetches run in React Server
// Components (no browser CORS involved).

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";
const REVALIDATE = 60; // ISR: articles regenerate at most once a minute

export type Ref = { name: string; slug: string; url: string };

export type Thumb = {
  url: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
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
  body_format: "legacy_html" | "tiptap_json";
  body_html: string | null;
  body_json: Record<string, unknown>;
  modified_at: string | null;
  authors: Ref[];
  categories: Ref[];
  featured_image: {
    url: string | null;
    alt: string | null;
    width: number | null;
    height: number | null;
    caption: string | null;
    credit: string | null;
  } | null;
  seo: ArticleSeo;
};

export type Category = { name: string; slug: string; kind: string; url: string };

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: REVALIDATE } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function listArticles(page = 1, perPage = 12) {
  const data = await get<{ articles: ArticleSummary[]; total: number; page: number }>(
    `/api/v1/articles?page=${page}&per_page=${perPage}`
  );
  return data ?? { articles: [], total: 0, page };
}

export async function getArticle(slug: string) {
  const data = await get<{ article: ArticleFull }>(`/api/v1/articles/${encodeURIComponent(slug)}`);
  return data?.article ?? null;
}

export async function listCategories() {
  const data = await get<{ categories: Category[] }>(`/api/v1/categories`);
  return data?.categories ?? [];
}

export async function getCategory(slug: string) {
  return get<{ category: Category; articles: ArticleSummary[] }>(
    `/api/v1/categories/${encodeURIComponent(slug)}`
  );
}
