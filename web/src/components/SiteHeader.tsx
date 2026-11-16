import Link from "next/link";
import { cookies } from "next/headers";
import HeaderNav, { HeaderSearch, MobileNav } from "@/components/header/HeaderNav";
import { getMenu, headerMenu, type MenuItem } from "@/lib/menu";
import { READER } from "@/lib/reader";

// The masthead: one slim navy bar that stays at the top while reading. The
// wordmark on the left (it goes home), the menu (edited in Strapi under
// Navigation → "Main menu"; Racing shows as Fields, Results and Calendar),
// and search and the reader's account as icons on the right. Phones and
// narrow windows get a menu button instead of the menu. The social links
// are in the footer. A "Login" menu item is skipped: the account icon does that.
export default async function SiteHeader() {
  const signedIn = !!(await cookies()).get(READER)?.value;
  const isLogin = (i: MenuItem) => i.href === "/login/" || i.title.toLowerCase() === "login";
  const menu = headerMenu((await getMenu("main-menu")).filter((i) => !isLogin(i)));
  return (
    <header className="sticky top-0 z-40 bg-navy shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      <div className="wrap flex h-16 items-center gap-4">
        <Link
          href="/"
          aria-label="Harnesslink, home"
          className="font-headline shrink-0 text-[28px] font-semibold leading-none tracking-[1px] text-white [font-variant-caps:small-caps] sm:text-[32px]"
        >
          HarnessLink
        </Link>

        <div className="ml-4 hidden lg:block xl:ml-8">
          <HeaderNav menu={menu} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <HeaderSearch />
          <Link
            href={signedIn ? "/my-account/" : "/login/"}
            aria-label={signedIn ? "My account" : "Sign in or register"}
            title={signedIn ? "My account" : "Sign in / Register"}
            className="grid h-10 w-10 place-items-center text-white hover:text-white/75"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
            </svg>
          </Link>
          <MobileNav menu={menu} signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
