// Server-only admin client (used exclusively from server components / actions). Talks to the Rails admin API with HTTP Basic creds
// held on the server (never exposed to the browser). The /admin routes are
// gated separately by middleware.ts.

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";

function authHeader() {
  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASSWORD || "";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function adminFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}/api/v1/admin${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
}

export type AdminArticleSummary = {
  id: number;
  slug: string;
  title: string;
  status: string;
  needs_review: boolean;
  import_flags: string[];
  published_at: string | null;
  primary_category: string | null;
  authors: string[];
};

export type AdminArticle = AdminArticleSummary & {
  subtitle: string | null;
  excerpt: string | null;
  body_format: string;
  body_html: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  category_ids: number[];
  author_ids: number[];
  legacy_url: string | null;
  legacy_wp_id: number | null;
};

export type Option = { id: number; name: string };

export async function listArticles(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await adminFetch(`/articles?${qs}`);
  if (!res.ok) return { articles: [] as AdminArticleSummary[], total: 0 };
  return res.json() as Promise<{ articles: AdminArticleSummary[]; total: number }>;
}

export async function getArticle(id: string) {
  const res = await adminFetch(`/articles/${id}`);
  if (!res.ok) return null;
  return (await res.json()).article as AdminArticle;
}

export async function updateArticle(id: string, body: Record<string, unknown>) {
  const res = await adminFetch(`/articles/${id}`, { method: "PATCH", body: JSON.stringify({ article: body }) });
  return res.ok;
}

export async function listCategories() {
  const res = await adminFetch(`/categories`);
  if (!res.ok) return [] as Option[];
  return (await res.json()).categories as Option[];
}

export async function listAuthors() {
  const res = await adminFetch(`/authors`);
  if (!res.ok) return [] as Option[];
  return ((await res.json()).authors as { id: number; name: string }[]).map((a) => ({ id: a.id, name: a.name }));
}

// ---- Directory admin ----

export type AdminDirectoryListing = {
  id: number;
  directory_type: string;
  name: string;
  slug: string;
  stud_name: string;
  country: string;
  region: string;
  is_paying: boolean;
  is_featured: boolean;
  path: string;
  // full-only
  gait?: string;
  status_note?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_website?: string;
  stud_website?: string;
  contact_address?: string;
  profile_bio?: string;
  race_record?: string;
  service_fee?: string;
  progeny_note?: string;
};

export type AdminDirectoryType = { key: string; plural: string };

export async function listDirectoryListings(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await adminFetch(`/directory_listings?${qs}`);
  if (!res.ok) return { listings: [] as AdminDirectoryListing[], types: [] as AdminDirectoryType[], total: 0 };
  return res.json() as Promise<{ listings: AdminDirectoryListing[]; types: AdminDirectoryType[]; total: number }>;
}

export async function getDirectoryListingAdmin(id: string) {
  const res = await adminFetch(`/directory_listings/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { listing: AdminDirectoryListing };
  return data.listing;
}

export async function saveDirectoryListing(id: string | null, body: Record<string, unknown>) {
  const path = id ? `/directory_listings/${id}` : `/directory_listings`;
  const res = await adminFetch(path, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify({ listing: body }),
  });
  return res.ok;
}

export async function deleteDirectoryListing(id: string) {
  const res = await adminFetch(`/directory_listings/${id}`, { method: "DELETE" });
  return res.ok;
}

// Multipart CSV upload — forwards the file to the Rails import endpoint.
export async function importDirectoryCsv(form: FormData) {
  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASSWORD || "";
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const base = process.env.API_BASE || "http://127.0.0.1:3001";
  const res = await fetch(`${base}/api/v1/admin/directory_listings/import`, {
    method: "POST",
    headers: { Authorization: auth }, // let fetch set the multipart boundary
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return { created: 0, updated: 0, skipped: 0, errors: ["Upload failed"] };
  return res.json() as Promise<{ created: number; updated: number; skipped: number; errors: string[] }>;
}

// ---- Ads admin ----

export type AdZone = { key: string; size: string; label: string };
export type AdminAd = {
  id: number;
  name: string;
  zone: string;
  size: string;
  image_url: string;
  link_url: string;
  alt: string;
  html: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  weight: number;
  impressions: number;
  clicks: number;
};

export async function listAds() {
  const res = await adminFetch(`/ads`);
  if (!res.ok) return { ads: [] as AdminAd[], zones: [] as AdZone[] };
  return res.json() as Promise<{ ads: AdminAd[]; zones: AdZone[] }>;
}

export async function getAdAdmin(id: string) {
  const res = await adminFetch(`/ads/${id}`);
  if (!res.ok) return null;
  return (await res.json() as { ad: AdminAd }).ad;
}

export async function saveAd(id: string | null, body: Record<string, unknown>) {
  const res = await adminFetch(id ? `/ads/${id}` : `/ads`, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify({ ad: body }),
  });
  return res.ok;
}

export async function deleteAd(id: string) {
  const res = await adminFetch(`/ads/${id}`, { method: "DELETE" });
  return res.ok;
}

export async function createArticle(body: Record<string, unknown>) {
  const res = await adminFetch(`/articles`, { method: "POST", body: JSON.stringify({ article: body }) });
  if (!res.ok) return null;
  return (await res.json() as { article: AdminArticle }).article;
}
