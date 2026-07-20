import Link from "next/link";
import { COUNTRIES, countryHref } from "@/lib/countries";

// The country pill row shown on region landing pages, highlighting the region
// you're currently in. Full names (not the compact codes) since there's room.
export default function RegionNav({ activeSlug }: { activeSlug?: string }) {
  return (
    <nav aria-label="Explore by country" className="flex flex-wrap gap-2">
      {COUNTRIES.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Link
            key={c.slug}
            href={countryHref(c.slug)}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full border border-navy/15 bg-white px-4 py-1.5 text-sm font-semibold text-navy hover:border-navy/40"
            }
          >
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
