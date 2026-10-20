"use client";

import { useActionState } from "react";
import { submitComment, type CommentState } from "@/components/article/comment-action";

const FIELD = "mt-1 w-full border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-navy";

export default function CommentForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(submitComment, { status: "idle" });

  if (state.status === "sent") {
    return (
      <p className="mt-5 border-l-2 border-navy pl-3 text-[15px] text-ink">
        Thanks — your comment will appear once an editor has approved it.
      </p>
    );
  }

  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="documentId" value={documentId} />
      <div className="hidden" aria-hidden>
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="block text-[13px] font-semibold text-ink">
        Comment
        <textarea name="content" required rows={4} maxLength={3000} className={FIELD} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold text-ink">
          Name
          <input name="name" required maxLength={60} autoComplete="name" className={FIELD} />
        </label>
        <label className="block text-[13px] font-semibold text-ink">
          Email <span className="font-normal text-muted">(never published)</span>
          <input name="email" type="email" required autoComplete="email" className={FIELD} />
        </label>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-[14px] text-red">
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="btn disabled:opacity-60">
          {pending ? "Sending…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}
