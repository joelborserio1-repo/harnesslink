"use server";

import { postComment } from "@/lib/comments";

export type CommentState = { status: "idle" | "sent" | "error"; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitComment(_prev: CommentState, form: FormData): Promise<CommentState> {
  // Bots fill every field; people never see this one.
  if (String(form.get("website") || "")) return { status: "sent" };

  const documentId = String(form.get("documentId") || "");
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const content = String(form.get("content") || "").trim();

  if (!documentId) return { status: "error", message: "Something went wrong — please reload the page." };
  if (name.length < 2 || name.length > 60) return { status: "error", message: "Please enter your name." };
  if (!EMAIL.test(email)) return { status: "error", message: "Please enter a valid email address." };
  if (content.length < 2) return { status: "error", message: "Please write a comment." };
  if (content.length > 3000) return { status: "error", message: "Comments are limited to 3,000 characters." };

  const res = await postComment(documentId, { name, email, content });
  return res.ok ? { status: "sent" } : { status: "error", message: res.message };
}
