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
    <nav aria-label="Breadcrumb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* The trail stops at the section: the story title is the H1 right below. */}
      <ol className="kicker flex flex-wrap items-center gap-2">
        {items.slice(0, -1).map((c, i) => (
          <li key={c.url} className="flex items-center gap-2">
            {i > 0 && <span className="text-navy/30" aria-hidden>/</span>}
            <Link href={c.url} className={i === 0 ? "text-muted hover:text-navy" : "hover:text-blue"}>
              {c.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
