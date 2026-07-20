import type { Metadata } from "next";
import Link from "next/link";
import { getDirectoryHub } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Harness Racing Directory",
  description:
    "The Harnesslink Directory — stallions, trainers, drivers, agistment, transport, vets and more, from around the harness racing world.",
  alternates: { canonical: "https://harnesslink.com/directory/" },
};

export default async function DirectoryHub() {
  const { types, total } = await getDirectoryHub();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow text-[15px]">The Industry</p>
        <h1 className="font-headline text-3xl font-extrabold text-navy sm:text-4xl">Harness Racing Directory</h1>
        <p className="mt-2 max-w-[64ch] text-[15px] text-[#41454e]">
          Stallions and studs, trainers, drivers and the services that keep the industry moving —
          browse {total > 0 ? `${total} listings ` : ""}by category.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <Link
              key={t.key}
              href={`/directory/${t.url}/`}
              className="group flex items-center justify-between rounded-lg border border-black/10 bg-page p-4 hover:border-navy/40"
            >
              <div>
                <h2 className="font-headline text-lg font-bold text-navy group-hover:text-blue">{t.plural}</h2>
                <p className="text-xs uppercase tracking-wide text-muted">{t.count} listed</p>
              </div>
              <span aria-hidden className="text-xl text-blue">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
