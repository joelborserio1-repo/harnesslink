import Link from "next/link";

export type Crumb = { name: string; url: string };

// Visual breadcrumb trail + BreadcrumbList JSON-LD. WordPress/Rank Math emitted
// breadcrumb structured data on articles, so this keeps SEO parity. `url` values
// are site-relative; the JSON-LD absolutises them against the canonical host.
const SITE = "https://harnesslink.com";

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url.startsWith("http") ? c.url : `${SITE}${c.url}`,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.url} className="flex items-center gap-1.5">
              {last ? (
                <span className="line-clamp-1 text-[#6b7280]" aria-current="page">
                  {c.name}
                </span>
              ) : (
                <Link href={c.url} className="font-semibold text-navy hover:text-blue">
                  {c.name}
                </Link>
              )}
              {!last && <span className="text-black/25">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
