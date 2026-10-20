import Link from "next/link";
import MenuDropdown from "@/components/MenuDropdown";
import MenuLink from "@/components/MenuLink";
import { NAV_ITEM } from "@/components/NavDropdown";
import { getMenu } from "@/lib/menu";
import { SOCIAL } from "@/lib/site";

// The live site's header: navy masthead with the centred wordmark, round
// social icons and a search line at the right, then the big uppercase menu
// (edited in Strapi under Navigation → "Main menu").
export default async function SiteHeader() {
  const menu = await getMenu("main-menu");
  return (
    <header className="bg-navy">
      <div className="wrap relative flex items-center justify-center pb-1 pt-5 sm:min-h-[83px] sm:pt-3">
        <Link
          href="/"
          aria-label="Harnesslink — home"
          className="font-headline text-[34px] font-semibold leading-none tracking-[1.1px] text-white [font-variant-caps:small-caps] sm:text-[48px]"
        >
          HarnessLink
        </Link>

        <div className="absolute right-4 top-3 hidden flex-col items-end gap-2 sm:right-[25px] md:flex">
          <ul className="flex items-center gap-2.5">
            {SOCIAL.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-7 w-7 place-items-center rounded-full bg-white text-navy hover:bg-white/85"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <form action="/search/" className="flex w-[150px] items-center border-b border-white/60">
            <input
              type="search"
              name="q"
              aria-label="Search Harnesslink"
              className="font-ui w-full bg-transparent py-1 text-[13px] text-white placeholder:text-white/50 focus:outline-none"
            />
            <button aria-label="Search" className="text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
        <Link href="/search/" aria-label="Search" className="absolute right-4 top-6 text-white md:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      <nav aria-label="Primary">
        <div className="wrap flex flex-wrap items-center justify-center">
          {menu.map((item, i) =>
            item.items.length ? (
              <MenuDropdown key={`${item.title}-${i}`} item={item} />
            ) : (
              <MenuLink key={`${item.title}-${i}`} item={item} className={NAV_ITEM} />
            )
          )}
        </div>
      </nav>
    </header>
  );
}
