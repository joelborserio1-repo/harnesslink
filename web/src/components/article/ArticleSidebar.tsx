import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import type { ArticleSummary } from "@/lib/api";

// The article-page rail: three stacked 300 × 250 boxes at the top, as on the
// live article template, then the latest-stories list. On phones it follows
// the article, so the boxes sit just above the footer — again as live.
export default function ArticleSidebar({ mostRead }: { mostRead: ArticleSummary[] }) {
  return (
    <aside className="flex flex-col gap-7 self-start">
      <AdSlot format="mpu" zone="article-rail" />

      {mostRead.length > 0 && (
        <section className="sheet p-5">
          <h2 className="rule-head font-headline text-[19px] font-bold text-navy">Latest stories</h2>
          <ol className="mt-1">
            {mostRead.map((a, i) => (
              <li key={a.id} className="group flex gap-3 border-b border-line py-3 last:border-b-0 last:pb-0">
                <span className="font-headline text-[22px] font-bold leading-none text-navy/25" aria-hidden>
                  {i + 1}
                </span>
                <Link href={a.url} className="font-headline text-[15px] font-bold leading-snug text-navy [text-wrap:balance]">
                  <span className="hl-link">{a.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

    </aside>
  );
}
