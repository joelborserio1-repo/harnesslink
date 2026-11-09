import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EmailFrame from "@/components/EmailFrame";
import SubscribeForm from "@/components/SubscribeForm";
import { getInsiderEdition } from "@/lib/api";
import { formatDate } from "@/lib/format";

// One edition of The Insider, at the same /edition/<slug>/ address the old
// WordPress site used, shown exactly as it was emailed.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const e = await getInsiderEdition(slug);
  if (!e) return {};
  return {
    title: { absolute: e.seoTitle || `${e.title} - Harnesslink` },
    description: e.seoDescription || e.summary || `The Insider, Harnesslink's weekly harness racing briefing — ${formatDate(e.date)}.`,
    alternates: { canonical: `https://harnesslink.com${e.url}` },
  };
}

export default async function EditionPage({ params }: Params) {
  const { slug } = await params;
  const e = await getInsiderEdition(slug);
  if (!e) notFound();

  return (
    <div className="wrap my-7">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <article className="min-w-0">
          <header className="sheet border-b-0 px-5 py-6 sm:px-8">
            <p className="kicker kicker-gold">
              <Link href="/the-insider/editions/" className="hover:underline">
                The Insider
              </Link>{" "}
              · Past edition
            </p>
            <h1 className="font-headline mt-2 text-[30px] font-bold leading-tight text-navy sm:text-[40px]">{formatDate(e.date)}</h1>
            {e.summary && <p className="mt-2 max-w-[65ch] text-[15px] text-[#474b54]">{e.summary}</p>}
          </header>
          <div className="sheet overflow-hidden">
            <EmailFrame html={e.html} title={e.title} />
          </div>
          <nav aria-label="More editions" className="mt-6 flex justify-between gap-4 text-[13px] font-bold uppercase tracking-[0.1em]">
            {e.older ? (
              <Link href={e.older.url} className="text-navy hover:text-blue">
                ← {formatDate(e.older.date)}
              </Link>
            ) : (
              <span />
            )}
            {e.newer ? (
              <Link href={e.newer.url} className="text-right text-navy hover:text-blue">
                {formatDate(e.newer.date)} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>

        <aside className="space-y-7 lg:sticky lg:top-4">
          <section className="bg-navy p-6 text-white">
            <p className="kicker !text-amber">Free every Thursday</p>
            <h2 className="font-headline mt-2 text-[24px] font-bold">Get The Insider</h2>
            <p className="mt-2 text-[14px] text-white/80">The week&apos;s form, features and whispers, straight to your inbox.</p>
            <div className="mt-4">
              <SubscribeForm dark cta="Subscribe" source="edition-page" />
            </div>
          </section>
          <p className="text-[13px]">
            <Link href="/the-insider/editions/" className="font-bold text-navy hover:text-blue">
              All past editions →
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
