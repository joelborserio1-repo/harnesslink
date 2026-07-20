import Link from "next/link";
import { listCategories } from "@/lib/api";

export default async function SiteHeader() {
  const categories = await listCategories();
  const geographic = categories.filter((c) => c.kind === "geographic");

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex flex-col leading-none">
          <span className="text-2xl font-extrabold tracking-tight text-neutral-900">
            HARNESS<span className="text-red-600">LINK</span>
          </span>
          <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            Harness Racing News
          </span>
        </Link>
        <nav className="hidden gap-5 text-sm font-semibold text-neutral-700 md:flex">
          {geographic.map((c) => (
            <Link key={c.slug} href={c.url} className="hover:text-red-600">
              {c.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
