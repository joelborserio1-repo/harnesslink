import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDirectoryType } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { type } = await params;
  const data = await getDirectoryType(type);
  if (!data) return {};
  return {
    title: `${data.type.plural} — Harness Racing Directory`,
    description: `Browse ${data.type.plural.toLowerCase()} in the Harnesslink directory.`,
    alternates: { canonical: `https://harnesslink.com/directory/${data.type.url}/` },
  };
}

export default async function DirectoryTypePage({ params }: Params) {
  const { type } = await params;
  const data = await getDirectoryType(type);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <nav className="mb-3 text-xs text-muted">
        <Link href="/directory/" className="font-semibold text-navy hover:text-blue">Directory</Link>
        <span className="px-1.5 text-black/25">›</span>
        <span>{data.type.plural}</span>
      </nav>

      <div className="card p-6 sm:p-8">
        <h1 className="font-headline text-3xl font-extrabold text-navy [text-wrap:balance]">{data.type.plural}</h1>

        {data.listings.length === 0 ? (
          <p className="py-10 text-neutral-500">No listings yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-black/[0.07]">
            {data.listings.map((l) => (
              <li key={l.id}>
                <Link href={l.path} className="group flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-headline text-lg font-bold text-navy [text-wrap:balance] group-hover:text-blue">
                        {l.name}
                      </h2>
                      {l.is_featured && (
                        <span className="rounded bg-amber px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#241a00]">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-[#4a4f59]">
                      {[l.stud_name, [l.region, l.country].filter(Boolean).join(", "), l.gait]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span aria-hidden className="text-blue">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
