import Link from "next/link";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// Left-hand panel of the homepage top row: The Eureka partnership hub. Shows
// the latest real Eureka stories rather than a static list of links.
export default function EurekaPanel({ stories, href }: { stories: ArticleSummary[]; href: string }) {
  return (
    <section className="sheet flex h-full flex-col border-t-[3px] border-t-navy p-6">
      <p className="kicker kicker-gold">The Eureka</p>
      <h2 className="font-headline mt-3 text-[26px] font-bold leading-[1.12] text-navy [text-wrap:balance]">
        Harness racing&apos;s richest race.
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4a4e57]">
        Race week coverage, runners, market moves and more.
      </p>
      <Link href={href} className="btn mt-4 self-start">
        Explore The Eureka <span aria-hidden>→</span>
      </Link>

      {stories.length > 0 && (
        <ul className="mt-5 border-t border-line">
          {stories.map((a) => (
            <li key={a.id} className="group border-b border-line py-3">
              <Link href={a.url} className="font-headline text-[15px] font-bold leading-snug text-navy">
                <span className="hl-link">{a.title}</span>
              </Link>
              {a.published_at && <p className="meta mt-1">{formatCardDate(a.published_at)}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-4 text-[12px] font-semibold tracking-wide text-muted">
        $2.1M · Menangle · September feature
      </p>
    </section>
  );
}
