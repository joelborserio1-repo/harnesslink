import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDirectoryListing } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ type: string; id: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { type, id, slug } = await params;
  const l = await getDirectoryListing(type, id);
  if (!l) return {};
  return {
    title: `${l.name} — ${l.type_label}`,
    description: l.profile_bio?.slice(0, 160) ?? `${l.name} in the Harnesslink harness racing directory.`,
    alternates: { canonical: `https://harnesslink.com/directory/${type}/${id}/${slug}/` },
  };
}

export default async function DirectoryProfile({ params }: Params) {
  const { type, id } = await params;
  const l = await getDirectoryListing(type, id);
  if (!l) notFound();

  const meta = [l.org_label && l.stud_name ? `${l.org_label}: ${l.stud_name}` : null,
    [l.region, l.country].filter(Boolean).join(", "), l.gait]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <nav className="mb-3 text-xs text-muted">
        <Link href="/directory/" className="font-semibold text-navy hover:text-blue">Directory</Link>
        <span className="px-1.5 text-black/25">›</span>
        <Link href={`/directory/${type}/`} className="font-semibold text-navy hover:text-blue">{l.type_label}s</Link>
        <span className="px-1.5 text-black/25">›</span>
        <span>{l.name}</span>
      </nav>

      <article className="card p-6 sm:p-10">
        <div className="flex items-center gap-2">
          <span className="eyebrow text-[13px]">{l.type_label}</span>
          {l.is_featured && (
            <span className="rounded bg-amber px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#241a00]">Featured</span>
          )}
        </div>
        <h1 className="font-headline text-4xl font-extrabold text-navy">{l.name}</h1>
        {meta && <p className="mt-1 text-[15px] text-[#41454e]">{meta}</p>}

        {(l.race_record || l.service_fee) && (
          <div className="mt-4 flex flex-wrap gap-6 border-y border-black/[0.08] py-3 text-sm">
            {l.race_record && <div><span className="text-muted">Race record</span><br /><b className="text-navy">{l.race_record}</b></div>}
            {l.service_fee && <div><span className="text-muted">Service fee</span><br /><b className="text-navy">{l.service_fee}</b></div>}
          </div>
        )}

        {l.profile_bio && <p className="mt-5 leading-relaxed text-[#333]">{l.profile_bio}</p>}

        {/* Contact — paid-tier only */}
        {l.contact ? (
          <div className="mt-6 rounded-lg border border-black/10 bg-page p-5">
            <h2 className="font-headline text-lg font-bold text-navy">Contact</h2>
            <ul className="mt-2 space-y-1 text-sm text-[#333]">
              {l.contact.phone && <li>📞 {l.contact.phone}</li>}
              {l.contact.email && <li>✉️ <a className="text-blue hover:underline" href={`mailto:${l.contact.email}`}>{l.contact.email}</a></li>}
              {l.contact.website && <li>🌐 <a className="text-blue hover:underline" href={l.contact.website} target="_blank" rel="noopener noreferrer">Website</a></li>}
              {l.contact.address && <li>📍 {l.contact.address}</li>}
            </ul>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-navy/25 bg-page p-5 text-sm text-[#41454e]">
            Contact details are available for enhanced listings.{" "}
            <Link href="/contact/" className="font-semibold text-blue hover:underline">Claim this listing →</Link>
          </div>
        )}

        {/* Progeny */}
        {l.progeny.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 font-headline text-xl font-bold text-navy">Notable Progeny</h2>
            {l.progeny_note && <p className="mb-3 text-sm text-[#4a4f59]">{l.progeny_note}</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/15 text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Sex</th>
                    <th className="py-2 pr-3">Starts–Wins</th>
                    <th className="py-2">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {l.progeny.map((p, i) => (
                    <tr key={i} className="border-b border-black/[0.06]">
                      <td className="py-2 pr-3 font-semibold text-navy">{p.name}</td>
                      <td className="py-2 pr-3">{p.sex}</td>
                      <td className="py-2 pr-3">{p.starts}–{p.wins}</td>
                      <td className="py-2">{p.prizemoney}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
