// Preview of unpublished stories and pages, opened from the Strapi admin's
// Preview button. The secret is shared with the CMS (PREVIEW_SECRET) and only
// ever used server-side.
const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");

export const PREVIEW_SECRET = process.env.PREVIEW_SECRET || "";

export function previewHeaders(): Record<string, string> {
  return { "x-preview-secret": PREVIEW_SECRET };
}

// Where a draft lives on the site, e.g. "/my-story/".
export async function previewTarget(uid: string, documentId: string): Promise<string | null> {
  const qs = new URLSearchParams({ uid, documentId });
  const res = await fetch(`${STRAPI_URL}/api/preview/target?${qs}`, { headers: previewHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { path?: string };
  return data.path?.startsWith("/") ? data.path : null;
}
