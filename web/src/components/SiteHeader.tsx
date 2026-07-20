import Link from "next/link";
import NewsMenu from "@/components/NewsMenu";
import RacingMenu from "@/components/RacingMenu";

// Editorial top nav from the live site. TODO: make DB-driven (nav is data in v1).
// "News" and "Racing" are special-cased below into dropdown/mega-menus.
const NAV = [
  { label: "The Insider", href: "/the-insider/" },
  { label: "Contact Us", href: "/contact/" },
  { label: "Directory", href: "/directory/" },
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

      {/* Primary nav — same royal navy, divided by a hairline. Wraps on narrow
          screens (no overflow clipping, so the News dropdown can escape). */}
      <nav className="border-t border-white/10 bg-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4">
          <Link
            href="/"
            className="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-semibold uppercase tracking-wide text-white/90 hover:border-accent hover:text-white"
          >
            Home
          </Link>

          {/* News → country dropdown, Racing → country/fields/results mega-menu */}
          <NewsMenu />
          <RacingMenu />

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
    </header>
  );
}
