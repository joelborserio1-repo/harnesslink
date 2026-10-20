import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDirectoryListing, type DirectoryListingFull } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ type: string; id: string; slug: string }> };

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { type, id, slug } = await params;
  const l = await getDirectoryListing(type, id);
  if (!l) return {};
  const about = l.short_summary || (l.profile_bio ? stripTags(l.profile_bio) : "");
  return {
    title: `${l.name} — ${l.type_label}`,
    description: about.slice(0, 160) || `${l.name} in the Harnesslink harness racing directory.`,
    alternates: { canonical: `https://harnesslink.com/directory/${type}/${id}/${slug}/` },
  };
}

// YouTube / Vimeo page links → their embeddable player URL.
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

type Ped = NonNullable<DirectoryListingFull["pedigree"]>;

function Pedigree({ p }: { p: Ped }) {
  // Three generations, sire's side above dam's (s = sire, d = dam).
  const cell = (key: keyof Ped, rows: number, strong = false) => (
    <td
      rowSpan={rows}
      className={`border border-line px-3 py-2 align-middle ${strong ? "font-headline font-bold text-navy" : "text-[#33363d]"}`}
    >
      {p[key] || <span className="text-muted">—</span>}
    </td>
  );
  const third = (["sss", "ssd", "sds", "sdd", "dss", "dsd", "dds", "ddd"] as const).some((k) => p[k]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[14px]">
        <tbody>
          <tr>
            {cell("sire", 4, true)}
            {cell("ss", 2)}
            {third && cell("sss", 1)}
          </tr>
          <tr>{third && cell("ssd", 1)}</tr>
          <tr>
            {cell("sd", 2)}
            {third && cell("sds", 1)}
          </tr>
          <tr>{third && cell("sdd", 1)}</tr>
          <tr>
            {cell("dam", 4, true)}
            {cell("ds", 2)}
            {third && cell("dss", 1)}
          </tr>
          <tr>{third && cell("dsd", 1)}</tr>
          <tr>
            {cell("dd", 2)}
            {third && cell("dds", 1)}
          </tr>
          <tr>{third && cell("ddd", 1)}</tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function DirectoryProfile({ params }: Params) {
  const { type, id } = await params;
  const l = await getDirectoryListing(type, id);
  if (!l) notFound();

  const where = [l.suburb, l.region, l.country].filter(Boolean).join(", ");
  const meta = [l.org_label && l.stud_name ? `${l.org_label}: ${l.stud_name}` : null, where, l.gait]
    .filter(Boolean)
    .join(" · ");
  // The unlabelled "vitals" line under the name, as on the live profile.
  const vitals = [
    l.pedigree?.sire && l.pedigree?.dam ? `${l.pedigree.sire} × ${l.pedigree.dam}` : null,
    l.year_of_birth,
    l.colour,
    l.sex,
  ]
    .filter(Boolean)
    .join(" · ");
  const hero = l.hero_image || l.profile_image;
  const gallery = l.gallery ?? [];
  const crosses = l.crosses ?? [];
  const related = l.related ?? [];
  const contactLines: Array<[string, string | undefined]> = l.contact
    ? [
        ["Phone", l.contact.phone],
        ["Address", l.contact.address],
        ["Australia", l.contact.au],
        ["New Zealand", l.contact.nz],
        ["North America", l.contact.us],
        ["France", l.contact.fr],
        ["Elsewhere", l.contact.other],
      ]
    : [];
  const website = l.contact?.website || l.contact?.stud_website;

  return (
    <div className="wrap max-w-[900px] py-7">
      <nav aria-label="Breadcrumb" className="kicker mb-4 flex flex-wrap items-center gap-2">
        <Link href="/directory/" className="text-muted hover:text-navy">
          Directory
        </Link>
        <span className="text-navy/30" aria-hidden>
          /
        </span>
        <Link href={`/directory/${type === "stallions" ? "stallion" : type}/`} className="hover:text-blue">
          {l.type_label}s
        </Link>
      </nav>

      <article className="sheet">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={l.name} className="block max-h-[460px] w-full object-cover" />
        )}
        <div className="px-5 py-7 sm:px-10 sm:py-9">
          <p className="kicker kicker-gold">
            {l.type_label}
            {l.is_featured ? " · Featured" : ""}
          </p>
          <h1 className="font-headline mt-1 text-[36px] font-bold leading-[1.08] text-navy sm:text-[46px]">{l.name}</h1>
          {vitals && <p className="mt-2 text-[15px] font-semibold text-[#33363d]">{vitals}</p>}
          {meta && <p className="mt-1 text-[14px] text-muted">{meta}</p>}
          {l.tagline && <p className="font-headline mt-4 text-[20px] italic leading-snug text-navy-deep">{l.tagline}</p>}

          {(l.race_record || l.career_earnings || l.service_fee || l.status_note) && (
            <dl className="mt-6 grid gap-x-8 gap-y-3 border-y border-line py-4 text-[14px] sm:grid-cols-4">
              {l.race_record && (
                <div className="sm:col-span-2">
                  <dt className="kicker !text-muted">Race record</dt>
                  <dd className="mt-1 font-semibold text-navy">{l.race_record}</dd>
                </div>
              )}
              {l.career_earnings && (
                <div>
                  <dt className="kicker !text-muted">Career earnings</dt>
                  <dd className="mt-1 font-semibold text-navy">{l.career_earnings}</dd>
                </div>
              )}
              {l.service_fee && (
                <div>
                  <dt className="kicker !text-muted">Service fee</dt>
                  <dd className="mt-1 font-semibold text-navy">{l.service_fee}</dd>
                </div>
              )}
              {l.status_note && (
                <div className="sm:col-span-4">
                  <dt className="kicker !text-muted">Status</dt>
                  <dd className="mt-1 text-[#33363d]">{l.status_note}</dd>
                </div>
              )}
            </dl>
          )}

          {l.booking && (
            <a href={l.booking.url} target="_blank" rel="noopener noreferrer" className="btn mt-6">
              {l.booking.label} <span aria-hidden>→</span>
            </a>
          )}

          {(l.profile_bio || l.short_summary) && (
            <section className="mt-8">
              <h2 className="rule-head font-headline text-[22px] font-bold text-navy">About {l.name}</h2>
              {l.profile_bio ? (
                <div className="prose-article mt-4" dangerouslySetInnerHTML={{ __html: l.profile_bio }} />
              ) : (
                <p className="prose-article mt-4">{l.short_summary}</p>
              )}
            </section>
          )}

          {l.pedigree && (l.pedigree.sire || l.pedigree.dam) && (
            <section className="mt-8">
              <h2 className="rule-head font-headline text-[22px] font-bold text-navy">Pedigree</h2>
              <div className="mt-4">
                <Pedigree p={l.pedigree} />
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section className="mt-8">
              <h2 className="rule-head font-headline text-[22px] font-bold text-navy">Gallery</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {gallery.map((g, i) => {
                  const embed = g.media_type === "video" ? embedUrl(g.url) : null;
                  return (
                    <figure key={i} className="m-0">
                      {embed ? (
                        <div className="relative aspect-video bg-mist">
                          <iframe
                            src={embed}
                            title={g.caption || `${l.name} video`}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 h-full w-full border-0"
                          />
                        </div>
                      ) : g.media_type === "video" ? (
                        <video src={g.url} controls preload="metadata" className="block w-full bg-black" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.url} alt={g.caption || l.name} loading="lazy" className="block w-full" />
                      )}
                      {(g.caption || g.description) && (
                        <figcaption className="mt-2 border-l-2 border-navy pl-2.5 text-[13px] text-muted">
                          {g.caption}
                          {g.description && <span className="block">{g.description}</span>}
                        </figcaption>
                      )}
                    </figure>
                  );
                })}
              </div>
            </section>
          )}

          {crosses.length > 0 && (
            <section className="mt-8">
              <h2 className="rule-head font-headline text-[22px] font-bold text-navy">Crosses of Gold</h2>
              {l.crosses_intro && <p className="mt-3 text-[15px] text-[#474b54]">{l.crosses_intro}</p>}
              <ul className="mt-3">
                {crosses.map((c, i) => (
                  <li key={i} className="border-b border-line py-3">
                    <p className="font-headline text-[17px] font-bold text-navy">{c.title}</p>
                    {c.description && <p className="mt-1 text-[14.5px] text-[#33363d]">{c.description}</p>}
                    {c.examples && <p className="mt-1 text-[13px] text-muted">{c.examples}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {l.progeny.length > 0 && (
            <section className="mt-8">
              <h2 className="rule-head font-headline text-[22px] font-bold text-navy">Notable progeny</h2>
              {l.progeny_note && <p className="mt-3 text-sm text-[#4a4f59]">{l.progeny_note}</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-left text-[14px]">
                  <thead>
                    <tr className="border-b-2 border-navy text-[11px] uppercase tracking-[0.1em] text-navy">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Sex</th>
                      <th className="py-2 pr-3">Starts–wins</th>
                      <th className="py-2 text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.progeny.map((p, i) => (
                      <tr key={i} className="border-b border-line">
                        <td className="py-2 pr-3 font-semibold text-navy">{p.name}</td>
                        <td className="py-2 pr-3">{p.sex}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {p.starts}–{p.wins}
                        </td>
                        <td className="py-2 text-right tabular-nums">{p.prizemoney}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Contact — paid listings only */}
          <section className="mt-8 border-t-[3px] border-navy bg-mist px-5 py-5">
            <h2 className="font-headline text-[20px] font-bold text-navy">Contact</h2>
            {l.contact ? (
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-[auto_1fr]">
                {l.contact.email && (
                  <>
                    <dt className="kicker pt-0.5 !text-muted">Email</dt>
                    <dd>
                      <a className="text-blue underline-offset-2 hover:underline" href={`mailto:${l.contact.email}`}>
                        {l.contact.email}
                      </a>
                    </dd>
                  </>
                )}
                {website && (
                  <>
                    <dt className="kicker pt-0.5 !text-muted">Website</dt>
                    <dd>
                      <a className="text-blue underline-offset-2 hover:underline" href={website} target="_blank" rel="noopener noreferrer">
                        {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </dd>
                  </>
                )}
                {contactLines
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <div key={label} className="contents">
                      <dt className="kicker pt-0.5 !text-muted">{label}</dt>
                      <dd className="whitespace-pre-line text-[#33363d]">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="mt-2 text-[14.5px] text-[#474b54]">
                Contact details are shown on enhanced listings.{" "}
                <Link href="/contact-us/" className="font-semibold text-navy underline underline-offset-2">
                  Claim or upgrade this listing
                </Link>
                .
              </p>
            )}
          </section>
        </div>
      </article>

      {related.length > 0 && (
        <section className="sheet mt-7 p-6">
          <h2 className="rule-head font-headline text-[22px] font-bold text-navy">Related</h2>
          <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id} className="border-b border-line py-3">
                <Link href={r.path} className="font-headline text-[16px] font-bold text-navy hover:text-blue">
                  {r.name}
                </Link>
                {r.stud_name && <p className="text-[13px] text-muted">{r.stud_name}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
