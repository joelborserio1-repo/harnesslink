import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import NextToGo from "@/components/home/NextToGo";
import InsiderPanel from "@/components/home/InsiderPanel";
import type { ArticleSummary } from "@/lib/api";

// The article-page rail: interleaved ad units and widgets (Next To Go, Most
// Read, The Insider). Sticky on desktop; hidden on mobile (a single in-flow
// ad is rendered under the article instead).
export default function ArticleSidebar({ mostRead }: { mostRead: ArticleSummary[] }) {
  return (
    <aside className="hidden self-start lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-6">
      <AdSlot size="mpu" zone="article-rail-1" />

      <NextToGo />

      {mostRead.length > 0 && (
        <div className="card p-5">
          <p className="eyebrow text-[14px]">Trending</p>
          <h2 className="mb-3 border-b-2 border-navy pb-2 font-headline text-lg font-extrabold text-navy">
            Most Read
          </h2>
          <ol className="flex flex-col divide-y divide-black/[0.07]">
            {mostRead.map((a, i) => (
              <li key={a.id} className="flex gap-3 py-2.5">
                <span className="font-headline text-xl font-extrabold text-blue/40">{i + 1}</span>
                <Link
                  href={a.url}
                  className="font-headline text-[14px] font-semibold leading-snug text-navy [text-wrap:balance] hover:text-blue"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <AdSlot size="mpu" zone="article-rail-2" />
      <InsiderPanel />
      <AdSlot size="halfpage" zone="article-rail-3" />
    </aside>
  );
}
