import Link from "next/link";
import MenuDropdown from "@/components/MenuDropdown";
import MenuLink from "@/components/MenuLink";
import { NAV_ITEM } from "@/components/NavDropdown";
import { cookies } from "next/headers";
import { getMenu, type MenuItem } from "@/lib/menu";
import { READER } from "@/lib/reader";
import { SOCIAL } from "@/lib/site";

// The masthead: round social icons at the top left, the centred wordmark,
// and at the top right the reader's account links above the search line;
// then the big uppercase menu (edited in Strapi under Navigation → "Main
// menu"). Sign in / Register live up here, so a "Login" menu item is skipped.
export default async function SiteHeader() {
  const signedIn = !!(await cookies()).get(READER)?.value;
  const isLogin = (i: MenuItem) => i.href === "/login/" || i.title.toLowerCase() === "login";
  const menu = (await getMenu("main-menu")).filter((i) => !isLogin(i));
  const account = "font-ui text-[12px] font-semibold uppercase tracking-[0.12em] text-white/85 hover:text-white";
  const person = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
  return (
    <header className="bg-navy">
      <div className="wrap relative flex items-center justify-center pb-1 pt-5 sm:min-h-[83px] sm:pt-3">
        <ul className="absolute left-4 top-4 hidden items-center gap-2.5 sm:left-[25px] md:flex">
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

        <Link
          href="/"
          aria-label="Harnesslink — home"
          className="font-headline text-[34px] font-semibold leading-none tracking-[1.1px] text-white [font-variant-caps:small-caps] sm:text-[48px]"
        >
          HarnessLink
        </Link>

        <div className="absolute right-4 top-3 hidden flex-col items-end gap-2 sm:right-[25px] md:flex">
          {signedIn ? (
            <Link href="/my-account/" className={`flex items-center gap-1.5 ${account}`}>
              {person}
              My account
            </Link>
          ) : (
            <p className="flex items-center gap-2">
              <Link href="/login/" className={account}>
                Sign in
              </Link>
              <span className="text-white/40" aria-hidden>
                ·
              </span>
              <Link href="/register/" className={account}>
                Register
              </Link>
            </p>
          )}
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

        {/* Phones: account and search icons at the top right. */}
        <div className="absolute right-4 top-6 flex items-center gap-4 text-white md:hidden">
          <Link href={signedIn ? "/my-account/" : "/login/"} aria-label={signedIn ? "My account" : "Sign in"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href="/search/" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
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
