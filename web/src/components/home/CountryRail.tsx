import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import type { Country } from "@/lib/countries";
import { countryHref } from "@/lib/countries";
import { formatCardDate } from "@/lib/format";

export type RegionBlock = { country: Country; articles: ArticleSummary[] };

// One region column: a lead story (thumb + headline) plus a couple of headline
// links, capped off with a link to the full region archive.
function CountryColumn({ country, articles }: RegionBlock) {
  const href = countryHref(country.slug);
  const [lead, ...rest] = articles;
  const more = rest.slice(0, 3);

  return (
    <div className="flex flex-col">
      <Link
        href={href}
        className="mb-3 flex items-center justify-between border-b-2 border-navy pb-1.5 font-headline text-lg font-extrabold text-navy hover:text-blue"
      >
        {country.name}
        <span aria-hidden className="text-sm font-bold text-blue">
          →
        </span>
      </Link>

      {lead ? (
        <>
          <article className="group">
            <Link href={lead.url} className="relative block aspect-[16/9] overflow-hidden rounded-md">
              <Thumb image={lead.image} seed={lead.id} alt={lead.title} sizes="(max-width:1024px) 100vw, 240px" className="transition duration-300 group-hover:scale-105" />
            </Link>
            <h3 className="mt-2 font-headline text-[15px] font-bold leading-[1.25] text-navy [text-wrap:balance] group-hover:text-blue">
              <Link href={lead.url}>{lead.title}</Link>
            </h3>
            {lead.published_at && (
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{formatCardDate(lead.published_at)}</p>
            )}
          </article>

          {more.length > 0 && (
            <ul className="mt-3 flex flex-col divide-y divide-black/[0.07] border-t border-black/[0.07]">
              {more.map((a) => (
                <li key={a.id} className="py-2">
                  <Link href={a.url} className="font-headline text-[13.5px] font-semibold leading-snug text-navy [text-wrap:balance] hover:text-blue">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">No stories yet.</p>
      )}

      <Link href={href} className="mt-3 text-[13px] font-semibold text-blue hover:underline">
        All {country.name} news →
      </Link>
    </div>
  );
}

export default function CountryRail({ regions }: { regions: RegionBlock[] }) {
  const populated = regions.filter((r) => r.articles.length > 0);
  if (populated.length === 0) return null;

  return (
    <div className="mt-5 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {populated.map((r) => (
        <CountryColumn key={r.country.slug} {...r} />
      ))}
    </div>
  );
}
