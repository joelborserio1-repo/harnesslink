import Link from "next/link";
import type { ArticleSummary } from "@/lib/api";
import { formatWire } from "@/lib/format";

// "Just in" — a text-only running list of the newest stories with their filing
// time. Gives the rail a newsroom function instead of being ads only.
export default function WireList({ articles }: { articles: ArticleSummary[] }) {
  if (articles.length === 0) return null;
  return (
    <section className="sheet p-5">
      <h2 className="rule-head font-headline text-[19px] font-bold text-navy">Just in</h2>
      <ol className="mt-2">
        {articles.map((a) => (
          <li key={a.id} className="group border-b border-line py-3 last:border-b-0 last:pb-0">
            <p className="meta">
              {a.category && <b>{a.category.name}</b>}
              {a.category && " · "}
              {a.published_at && <time dateTime={a.published_at}>{formatWire(a.published_at)}</time>}
            </p>
            <Link href={a.url} className="font-headline mt-1 block text-[15px] font-bold leading-snug text-navy">
              <span className="hl-link">{a.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
