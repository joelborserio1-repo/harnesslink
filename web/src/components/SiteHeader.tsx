import Link from "next/link";
import NewsMenu from "@/components/NewsMenu";
import RacingMenu from "@/components/RacingMenu";
import SocialLinks from "@/components/SocialLinks";

// Editorial top nav from the live site. TODO: make DB-driven (nav is data in v1).
// "News" and "Racing" are special-cased below into dropdown/mega-menus.
const NAV = [
  { label: "The Insider", href: "/the-insider/" },
  { label: "Contact Us", href: "/contact-us/" },
  { label: "Directory", href: "/directory/" },
  { label: "Login", href: "/" },
];

const NAV_LINK =
  "whitespace-nowrap border-b-2 border-transparent py-2.5 text-[12px] sm:py-3 sm:text-[13px] font-semibold uppercase tracking-[0.12em] text-white/85 hover:border-amber hover:text-white";

export default function SiteHeader() {
  return (
    <header className="bg-navy">
      {/* Masthead — the wordmark is centred, as on the live site. */}
      <div className="wrap grid grid-cols-[1fr_auto_1fr] items-center py-5">
        <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 md:block">
          Standardbred news, worldwide
        </p>
        <Link
          href="/"
          aria-label="Harnesslink — home"
          className="col-start-2 font-headline text-[34px] font-bold leading-none tracking-[0.04em] text-white [font-variant-caps:small-caps] sm:text-[42px]"
        >
          HarnessLink
        </Link>
        <div className="col-start-3 flex items-center justify-end gap-4 text-white/75">
          <SocialLinks className="hidden sm:flex" />
          <Link href="/search/" aria-label="Search" className="hover:text-white sm:border-l sm:border-white/20 sm:pl-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Primary nav — centred under the wordmark, divided by a hairline. Wraps
          on narrow screens (no overflow clipping, so the menus can escape). */}
      <nav aria-label="Primary" className="border-t border-white/15">
        <div className="wrap flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8">
          <Link href="/" className={NAV_LINK}>
            Home
          </Link>

          {/* News → country dropdown, Racing → country/fields/results mega-menu */}
          <NewsMenu />
          <RacingMenu />

          {NAV.map((item) => (
            <Link key={item.label} href={item.href} className={NAV_LINK}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
