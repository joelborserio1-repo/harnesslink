import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import type { ArticleSummary } from "@/lib/api";

// The article-page rail: ad units with the latest-stories list between them,
// mirroring the live article template (a column of advertiser creatives).
// Sticky on desktop; hidden on mobile (a single in-flow ad is rendered under
// the article instead).
export default function ArticleSidebar({ mostRead }: { mostRead: ArticleSummary[] }) {
  return (
    <aside className="hidden self-start lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-7">
      <AdSlot size="mpu" zone="article-rail-1" />

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

      <AdSlot size="mpu" zone="article-rail-2" />
      <AdSlot size="halfpage" zone="article-rail-3" />
    </aside>
  );
}
