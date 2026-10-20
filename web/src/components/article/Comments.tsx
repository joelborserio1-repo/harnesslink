import CommentForm from "@/components/article/CommentForm";
import { getComments } from "@/lib/comments";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" });

export default async function Comments({ documentId }: { documentId: string }) {
  const comments = await getComments(documentId);
  return (
    <section id="comments" aria-labelledby="comments-head" className="mt-9">
      <h2 id="comments-head" className="rule-head font-headline text-[22px] font-bold text-navy">
        {comments.length ? `Comments (${comments.length})` : "Comments"}
      </h2>
      {comments.length > 0 && (
        <ol className="mt-4 divide-y divide-line">
          {comments.map((c) => (
            <li key={c.id} className="py-4">
              <p className="meta">
                <b>{c.name}</b> · {date(c.createdAt)}
              </p>
              <p className="mt-1.5 whitespace-pre-line text-[16px] leading-relaxed text-ink">{c.content}</p>
            </li>
          ))}
        </ol>
      )}
      <CommentForm documentId={documentId} />
    </section>
  );
}
