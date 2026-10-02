import ArticleTile from "@/components/home/ArticleTile";
import AdSlot from "@/components/AdSlot";
import type { ArticleSummary } from "@/lib/api";

export default function ArchiveSection({
  eyebrow,
  title,
  subtitle,
  articles,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  articles: ArticleSummary[];
}) {
  return (
    <div className="wrap py-7">
      <header className="mb-6 border-b border-line pb-5">
        {eyebrow && <p className="kicker kicker-gold">{eyebrow}</p>}
        <h1 className="font-headline mt-1 text-[36px] font-bold leading-[1.05] text-navy [text-wrap:balance] sm:text-[46px]">
          {title}
        </h1>
        {subtitle && <p className="mt-3 max-w-[64ch] text-[15px] text-[#474b54]">{subtitle}</p>}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="sheet min-w-0 p-6">
          {articles.length === 0 ? (
            <p className="py-10 text-neutral-500">No articles yet.</p>
          ) : (
            <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
              {articles.map((a) => (
                <ArticleTile key={a.id} article={a} />
              ))}
            </div>
          )}
        </div>
        <aside className="hidden flex-col gap-7 lg:sticky lg:top-4 lg:flex">
          <AdSlot size="mpu" zone="archive-rail-1" />
          <AdSlot size="halfpage" zone="archive-rail-2" />
        </aside>
      </div>
    </div>
  );
}
