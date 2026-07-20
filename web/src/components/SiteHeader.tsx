import Link from "next/link";
import { COUNTRIES, countryHref } from "@/lib/countries";

// Editorial top nav from the live site. TODO: make DB-driven (nav is data in v1).
const NAV = [
  { label: "Home", href: "/" },
  { label: "News", href: "/" },
  { label: "Racing", href: "/" },
  { label: "The Insider", href: "/" },
  { label: "Contact Us", href: "/" },
  { label: "Directory", href: "/" },
  { label: "Login", href: "/" },
];

export default function SiteHeader() {
  return (
    <header>
      {/* Masthead — royal navy, matching the white HARNESSLINK wordmark logo. */}
      <div className="bg-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex flex-col leading-none">
            <span className="font-headline text-3xl font-extrabold uppercase tracking-[0.12em] text-white sm:text-4xl">
              Harnesslink
            </span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">
              Harness Racing News
            </span>
          </Link>
          <Link
            href="/"
            className="hidden rounded bg-amber px-4 py-2 text-sm font-bold text-[#241a00] hover:brightness-105 sm:block"
          >
            The Insider
          </Link>
        </div>
      </div>

      {/* Primary nav — same royal navy, divided by a hairline. */}
      <nav className="border-t border-white/10 bg-navy">
        <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-semibold uppercase tracking-wide text-white/90 hover:border-accent hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Explore by Countries — the geographic sections. Archives at /category/{slug}/. */}
      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2">
          <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted">
            Explore by Country
          </span>
          {COUNTRIES.map((c) => (
            <Link
              key={c.slug}
              href={countryHref(c.slug)}
              className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold text-navy hover:bg-navy hover:text-white"
            >
              {c.code}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
