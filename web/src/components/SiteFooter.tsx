import Link from "next/link";
import { listCategories } from "@/lib/api";

export default async function SiteFooter() {
  const categories = await listCategories();
  const geographic = categories.filter((c) => c.kind === "geographic");

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-lg font-extrabold tracking-tight text-white">
          HARNESS<span className="text-red-500">LINK</span>
        </div>
        <p className="mt-2 max-w-md text-sm text-neutral-400">
          Harness racing&apos;s global news source — results, features and analysis
          from Australia, New Zealand, North America and Europe.
        </p>

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Explore by Countries
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {geographic.map((c) => (
              <li key={c.slug}>
                <Link href={c.url} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-xs text-neutral-500">
          © {new Date().getFullYear()} Harnesslink. Rebuilt on Rails + Next.js.
        </p>
      </div>
    </footer>
  );
}
