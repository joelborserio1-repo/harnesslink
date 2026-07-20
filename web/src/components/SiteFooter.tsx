import Link from "next/link";
import { listCategories } from "@/lib/api";

const QUICK_LINKS = [
  { label: "Contributors", href: "/" },
  { label: "Subscribe", href: "/" },
  { label: "Contact", href: "/" },
  { label: "Advertise With Us!", href: "/" },
];

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-3 w-3 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkList({ items }: { items: { label: string; href: string }[] }) {
  return (
    <ul className="mt-4 space-y-2.5 text-sm">
      {items.map((l) => (
        <li key={l.label} className="flex items-start gap-2">
          <Chevron />
          <Link href={l.href} className="text-neutral-300 hover:text-white">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Social({ label, path }: { label: string; path: string }) {
  return (
    <a
      href="/"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy hover:bg-neutral-200"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d={path} />
      </svg>
    </a>
  );
}

export default async function SiteFooter() {
  const categories = await listCategories();
  const geographic = categories.filter((c) => c.kind === "geographic");
  const countries = [{ label: "All", href: "/" }, ...geographic.map((c) => ({ label: c.name, href: c.url }))];

  return (
    <footer className="mt-16 bg-navy text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand + tagline + social */}
        <div>
          <div className="font-headline text-2xl font-extrabold uppercase tracking-[0.12em] text-white">
            Harnesslink
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
            Harnesslink.com is the only harness racing website dedicated to covering
            news and events in the Standardbred Industry world-wide.
          </p>
          <div className="mt-6 flex gap-3">
            <Social label="Facebook" path="M13 22v-8h3l.5-3.5H13V8.2c0-1 .3-1.7 1.8-1.7H17V3.3A24 24 0 0014.4 3C11.9 3 10 4.5 10 7.7v2.8H7V14h3v8z" />
            <Social label="X" path="M17.5 3H21l-7.3 8.3L22 21h-6.4l-5-6.1L4.8 21H1.3l7.8-8.9L2 3h6.6l4.5 5.6zm-1.1 16h1.9L7.7 5H5.7z" />
            <Social label="Instagram" path="M12 8.8A3.2 3.2 0 1012 15.2 3.2 3.2 0 0012 8.8zm0-2.2c-2.9 0-5.4 2.5-5.4 5.4S9.1 17.4 12 17.4s5.4-2.5 5.4-5.4S14.9 6.6 12 6.6zm6.9-.4a1.3 1.3 0 11-2.6 0 1.3 1.3 0 012.6 0zM12 4.2c1.7 0 1.9 0 2.6 0 1.7.1 2.6.4 3.2.6.8.3 1.4.7 2 1.3.6.6 1 1.2 1.3 2 .2.6.5 1.5.6 3.2 0 .7 0 .9 0 2.6s0 1.9 0 2.6c-.1 1.7-.4 2.6-.6 3.2-.3.8-.7 1.4-1.3 2-.6.6-1.2 1-2 1.3-.6.2-1.5.5-3.2.6-.7 0-.9 0-2.6 0s-1.9 0-2.6 0c-1.7-.1-2.6-.4-3.2-.6-.8-.3-1.4-.7-2-1.3-.6-.6-1-1.2-1.3-2-.2-.6-.5-1.5-.6-3.2 0-.7 0-.9 0-2.6s0-1.9 0-2.6c.1-1.7.4-2.6.6-3.2.3-.8.7-1.4 1.3-2 .6-.6 1.2-1 2-1.3.6-.2 1.5-.5 3.2-.6.7 0 .9 0 2.6 0z" />
            <Social label="YouTube" path="M23 12s0-3.1-.4-4.6a2.4 2.4 0 00-1.7-1.7C19.4 5.3 12 5.3 12 5.3s-7.4 0-8.9.4A2.4 2.4 0 001.4 7.4C1 8.9 1 12 1 12s0 3.1.4 4.6a2.4 2.4 0 001.7 1.7c1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4a2.4 2.4 0 001.7-1.7C23 15.1 23 12 23 12zM9.8 15.1V8.9l5.3 3.1z" />
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="font-headline text-lg font-bold text-white">Quick Links</h2>
          <LinkList items={QUICK_LINKS} />
        </div>

        {/* Explore by Countries */}
        <div>
          <h2 className="font-headline text-lg font-bold text-white">Explore by Countries</h2>
          <LinkList items={countries} />
        </div>

        {/* Contact Info */}
        <div>
          <h2 className="font-headline text-lg font-bold text-white">Contact Info</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-neutral-300">
            <li>
              <a href="tel:+61423233288" className="hover:text-white">+61 423 233 288</a>
            </li>
            <li>
              <a href="mailto:admin@harnesslink.com" className="hover:text-white">admin@harnesslink.com</a>
            </li>
            <li>
              <Link href="/" className="hover:text-white">More Details …</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Harnesslink | All Rights Reserved | Designed with intention by JTB ASSET GROUP</p>
          <p className="flex gap-4">
            <Link href="/" className="hover:text-white">Disclaimers</Link>
            <Link href="/" className="hover:text-white">Privacy Policy</Link>
            <Link href="/" className="hover:text-white">Terms &amp; Conditions</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
