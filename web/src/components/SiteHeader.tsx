import Link from "next/link";

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
      {/* Masthead */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex flex-col leading-none">
            {/* Swap for <img src="/harnesslink-logo.png"> once the asset lands. */}
            <span className="font-headline text-3xl font-extrabold tracking-tight text-navy">
              Harnesslink
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">
              Harness Racing News
            </span>
          </Link>
          <Link
            href="/"
            className="hidden rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 sm:block"
          >
            The Insider
          </Link>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="bg-navy-deep">
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
    </header>
  );
}
