import Link from "next/link";
import { COUNTRIES, countryHref } from "@/lib/countries";

// The country switcher on region landing pages — a row of plain text links on
// a rule, with the current region underlined. Full names since there's room.
export default function RegionNav({ activeSlug }: { activeSlug?: string }) {
  return (
    <nav aria-label="Explore by country" className="flex flex-wrap gap-x-7 border-b border-line">
      {COUNTRIES.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Link
            key={c.slug}
            href={countryHref(c.slug)}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-[3px] py-2.5 text-[13px] font-bold uppercase tracking-[0.12em] ${
              active ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"
            }`}
          >
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}
