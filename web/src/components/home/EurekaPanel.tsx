import Link from "next/link";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// Left-hand panel of the homepage top row: The Eureka partnership hub. Shows
// the latest real Eureka stories rather than a static list of links.
export default function EurekaPanel({ stories, href }: { stories: ArticleSummary[]; href: string }) {
  return (
    <section className="sheet relative flex h-full flex-col overflow-hidden px-6 py-6 sm:pl-[49px] sm:pr-[29px] sm:py-7 xl:h-[440px] xl:py-6 xl:pl-9">
      <p className="panel-label">The Eureka</p>
      <h2 className="font-headline mt-3 text-[30px] font-semibold leading-[1.15] text-[#070400] [text-wrap:balance] sm:text-[34px] xl:mt-2 xl:text-[28px]">
        Harness racing&apos;s richest race.
      </h2>
      <p className="mt-2 text-[14px] leading-[1.45] text-[#5B6478] xl:hidden 2xl:block">
        Race week coverage, runners, market moves and more.
      </p>
      <Link href={href} className="btn mt-5 self-start xl:mt-4 bg-navy-deep normal-case tracking-normal text-[14px]">
        Explore The Eureka <span aria-hidden>→</span>
      </Link>

      {stories.length > 0 && (
        <ul className="mt-5 border-t border-line xl:mt-4">
          {stories.map((a) => (
            <li key={a.id} className="group border-b border-line py-3 xl:py-2.5 xl:[&:nth-child(n+3)]:hidden">
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
