import ArticleTile from "@/components/home/ArticleTile";
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
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="card p-6 sm:p-8">
        {eyebrow && <p className="eyebrow text-[15px]">{eyebrow}</p>}
        <h1 className="font-headline text-3xl font-extrabold text-navy [text-wrap:balance]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[64ch] text-[15px] text-[#41454e]">{subtitle}</p>}
        {articles.length === 0 ? (
          <p className="py-10 text-neutral-500">No articles yet.</p>
        ) : (
          <div className="mt-6 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleTile key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
