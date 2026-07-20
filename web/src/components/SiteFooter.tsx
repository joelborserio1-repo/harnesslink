import Link from "next/link";
import { listCategories } from "@/lib/api";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "News", href: "/" },
  { label: "Racing", href: "/" },
  { label: "The Insider", href: "/" },
  { label: "Contact Us", href: "/" },
  { label: "Directory", href: "/" },
];

export default async function SiteFooter() {
  const categories = await listCategories();
  const geographic = categories.filter((c) => c.kind === "geographic");

  return (
    <footer className="mt-16 bg-navy-deep text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="font-headline text-2xl font-extrabold text-white">Harnesslink</div>
          <p className="mt-3 max-w-sm text-sm text-neutral-400">
            Harness racing&apos;s global news source — results, features and analysis
            from Australia, New Zealand, North America and Europe.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Quick Links
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {QUICK_LINKS.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Explore by Countries
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {geographic.map((c) => (
              <li key={c.slug}>
                <Link href={c.url} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-neutral-500">
          © {new Date().getFullYear()} Harnesslink. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
