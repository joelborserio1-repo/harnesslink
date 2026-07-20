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
