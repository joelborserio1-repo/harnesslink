// Reader comments (Strapi Comments plugin). Every comment waits for an
// editor's approval in the admin (Comments → Discover) before it shows here.
const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");

export type ReaderComment = { id: number; name: string; content: string; createdAt: string };

type Raw = {
  id: number;
  content: string;
  createdAt: string;
  approvalStatus?: string | null;
  removed?: boolean | null;
  blocked?: boolean | null;
  author?: { name?: string } | null;
};

export const relatedKey = (documentId: string) => `api::article.article:${documentId}`;

export async function getComments(documentId: string): Promise<ReaderComment[]> {
  try {
    const res = await fetch(
      `${STRAPI_URL}/api/comments/${relatedKey(documentId)}/flat?sort=createdAt:asc&pagination[pageSize]=200`,
      { next: { revalidate: 60, tags: [`comments:${documentId}`] }, signal: AbortSignal.timeout(2000) }
    );
    if (!res.ok) return [];
    const body = (await res.json()) as Raw[] | { data?: Raw[] };
    const rows = Array.isArray(body) ? body : body.data || [];
    return rows
      .filter((c) => c.approvalStatus === "APPROVED" && !c.removed && !c.blocked)
      .map((c) => ({ id: c.id, name: c.author?.name || "Reader", content: c.content, createdAt: c.createdAt }));
  } catch {
    return [];
  }
}

export async function postComment(documentId: string, input: { name: string; email: string; content: string }) {
  const res = await fetch(`${STRAPI_URL}/api/comments/${relatedKey(documentId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author: { id: crypto.randomUUID(), name: input.name, email: input.email },
      content: input.content,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (res.ok) return { ok: true as const };
  const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false as const, message: err?.error?.message || "Sorry, that didn't go through. Please try again." };
}
