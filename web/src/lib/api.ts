// Server-side API client for the Rails backend. Fetches run in React Server
// Components (no browser CORS involved).

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";
const REVALIDATE = 60; // ISR: articles regenerate at most once a minute

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
};

export type Category = { name: string; slug: string; kind: string; url: string };

async function get<T>(path: string): Promise<T | null> {
  // Fail-soft: never throw. This lets `next build` succeed even when the API
  // isn't running (e.g. building the Docker image), and keeps the site up if
  // the API blips at runtime.
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: REVALIDATE } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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

export async function getAuthor(slug: string) {
  return get<{
    author?: { name: string; slug: string; bio: string | null; role_title: string | null; url: string };
    articles?: ArticleSummary[];
    redirect_to?: string;
  }>(`/api/v1/authors/${encodeURIComponent(slug)}`);
}

export async function getTag(slug: string) {
  return get<{ tag: { name: string; slug: string; url: string }; articles: ArticleSummary[] }>(
    `/api/v1/tags/${encodeURIComponent(slug)}`
  );
}

// ---- Directory ----

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
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    stud_website?: string;
    address?: string;
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

// ---- Ads ----

export type AdCreative = {
  id: number;
  zone: string;
  size: string;
  image_url: string | null;
  html: string | null;
  alt: string;
  click_url: string;
};

// Zone → creative map for every filled zone. Fetched once per request (Next
// dedupes the fetch across all AdSlots on the page).
export async function getAds(): Promise<Record<string, AdCreative>> {
  const data = await get<{ ads: Record<string, AdCreative> }>(`/api/v1/ads`);
  return data?.ads ?? {};
}
