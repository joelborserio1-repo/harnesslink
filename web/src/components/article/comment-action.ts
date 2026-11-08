"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { postComment } from "@/lib/comments";
import { SESSION, readerApi } from "@/lib/reader";

export type CommentState = { status: "idle" | "sent" | "error"; message?: string };

// Only signed-in readers comment. The name shown is the one on their account,
// checked here on the server, never taken from the form.
export async function submitComment(_prev: CommentState, form: FormData): Promise<CommentState> {
  // Bots fill every field; people never see this one.
  if (String(form.get("website") || "")) return { status: "sent" };

  const token = (await cookies()).get(SESSION)?.value;
  if (!token) return { status: "error", message: "Please sign in to comment." };
  const me = await readerApi("me", { token });
  if (!me.ok) return { status: "error", message: "Your session has ended — please sign in again to comment." };
  const reader = ((me.data as { reader?: unknown })?.reader || {}) as { email?: string; firstName?: string; lastName?: string };
  const name = [reader.firstName, reader.lastName].filter(Boolean).join(" ").trim();
  if (!reader.email || name.length < 2) return { status: "error", message: "Add your name under My account, then post your comment." };

  const documentId = String(form.get("documentId") || "");
  const content = String(form.get("content") || "").trim();
  if (!documentId) return { status: "error", message: "Something went wrong — please reload the page." };
  if (content.length < 2) return { status: "error", message: "Please write a comment." };
  if (content.length > 3000) return { status: "error", message: "Comments are limited to 3,000 characters." };

  const authorId = `reader-${createHash("sha256").update(reader.email.toLowerCase()).digest("hex").slice(0, 16)}`;
  const res = await postComment(documentId, { authorId, name: name.slice(0, 60), email: reader.email, content });
  return res.ok ? { status: "sent" } : { status: "error", message: res.message };
}
