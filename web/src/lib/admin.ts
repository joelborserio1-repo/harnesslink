// Server-only admin client (used exclusively from server components / actions).
// Talks to the Rails admin API as the signed-in staff member: the session token
// lives in an httpOnly cookie and is replayed as a Bearer token, so it is never
// readable by browser JavaScript. /admin routes are also gated in proxy.ts.
import { cookies } from "next/headers";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:3001";

export const SESSION_COOKIE = "hl_staff";

async function authHeader() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? `Bearer ${token}` : "";
}

async function adminFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}/api/v1/admin${path}`, {
    ...init,
    headers: { Authorization: await authHeader(), "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
}

// ---- Session + staff accounts ----

export type Role = "contributor" | "editor" | "admin";

export type StaffUser = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  author_id: number | null;
  author_name: string | null;
  last_sign_in_at: string | null;
};

export const canPublish = (u: StaffUser | null) => u?.role === "editor" || u?.role === "admin";

// Exchange email + password for a session token. Returns the token or an error
// message suitable for showing on the login form.
export async function signIn(email: string, password: string): Promise<{ token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
    if (res.ok && data.token) return { token: data.token };
    return { error: data.error || "Sign-in failed. Try again." };
  } catch {
    return { error: "The editorial system isn't reachable right now. Try again in a minute." };
  }
}

export async function getMe(): Promise<StaffUser | null> {
  if (!(await authHeader())) return null;
  const res = await adminFetch(`/session`);
  if (!res.ok) return null;
  return ((await res.json()) as { user: StaffUser }).user;
}

export async function listUsers() {
  const res = await adminFetch(`/users`);
  if (!res.ok) return [] as StaffUser[];
  return ((await res.json()) as { users: StaffUser[] }).users;
}

// Returns null on success, or the validation messages.
export async function saveUser(id: number | null, body: Record<string, unknown>): Promise<string[] | null> {
  const res = await adminFetch(id ? `/users/${id}` : `/users`, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify({ user: body }),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { errors?: string[]; error?: string };
  return data.errors ?? [data.error ?? "Couldn't save that account."];
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
  created_by: string | null;
  updated_at: string | null;
};

export type AdminArticle = AdminArticleSummary & {
  subtitle: string | null;
  excerpt: string | null;
  body_format: string;
  body_html: string | null;
  body_json: Record<string, unknown> | null;
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
  const auth = await authHeader();
  const base = API_BASE;
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

export type AdZone = {
  key: string;
  size: string;
  format: string;
  slots: number;
  label: string;
  dimensions: { width: number; height: number; label: string };
};
export type AdminAd = {
  id: number;
  name: string;
  zone: string;
  size: string;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
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

export type AdminStats = {
  published: number;
  drafts: number;
  needs_review: number;
  in_review: number;
  my_drafts: number;
  total_views: number;
  subscribers: number;
  listings: number;
  active_ads: number;
};

export async function getAdminStats() {
  const res = await adminFetch(`/stats`);
  if (!res.ok) return null;
  return (await res.json()) as AdminStats;
}
