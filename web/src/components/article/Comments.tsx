import Link from "next/link";
import { cookies } from "next/headers";
import CommentForm from "@/components/article/CommentForm";
import { getComments } from "@/lib/comments";
import { READER, SESSION } from "@/lib/reader";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" });

// Anyone can read approved comments; only signed-in readers can post. Signed
// out, the form is replaced by "Sign in to comment", which brings them back
// here afterwards.
export default async function Comments({ documentId, path }: { documentId: string; path: string }) {
  const [comments, jar] = await Promise.all([getComments(documentId), cookies()]);
  const signedIn = !!jar.get(SESSION)?.value;
  const firstName = decodeURIComponent(jar.get(READER)?.value || "") || "you";
  const back = encodeURIComponent(`${path}#comments`);
  return (
    <section id="comments" aria-labelledby="comments-head" className="mt-9 scroll-mt-6">
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
      {signedIn ? (
        <CommentForm documentId={documentId} name={firstName} />
      ) : (
        <div className="mt-5 border-t border-line pt-5">
          <Link href={`/login/?next=${back}`} className="btn">
            Sign in to comment
          </Link>
          <p className="mt-3 text-[14px] text-muted">
            New here?{" "}
            <Link href={`/register/?next=${back}`} className="font-semibold text-navy underline underline-offset-2">
              Create a free account
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
