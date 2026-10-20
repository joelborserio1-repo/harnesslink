// XML for the sitemaps and RSS feed, built from the CMS's lean listings. Same
// output as the Rails builder it replaces: a paginated index, 10,000 URLs per
// article sitemap, a Google News sitemap of the last 48 hours, and an archive
// sitemap of section, country, page, writer and tag URLs.
import { sitemapArchives, sitemapArticles, listArticles } from "@/lib/api";

export const PER_PAGE = 10_000;
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;
const NEWS_MAX = 1000;
const FEED_MAX = 50;
const SITE = (process.env.SITE_URL || "https://harnesslink.com").replace(/\/$/, "");

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const loc = (slug: string) => `${SITE}/${slug}/`;
const iso = (d: string | null) => (d ? new Date(d).toISOString() : null);

export function xmlResponse(body: string) {
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

export async function indexXml() {
  const { total } = await sitemapArticles(1, 1);
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const entries = Array.from({ length: pages }, (_, i) => `<sitemap><loc>${SITE}/sitemap-articles-${i + 1}.xml</loc></sitemap>`);
  entries.push(`<sitemap><loc>${SITE}/news-sitemap.xml</loc></sitemap>`);
  entries.push(`<sitemap><loc>${SITE}/archives-sitemap.xml</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>
`;
}

export async function articlesXml(page: number) {
  const { articles } = await sitemapArticles(Math.max(page, 1), PER_PAGE);
  const urls = articles.map((a) => {
    const lastmod = iso(a.lastmod);
    return `<url><loc>${loc(a.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export async function newsXml() {
  const since = new Date(Date.now() - NEWS_WINDOW_MS).toISOString();
  const { articles } = await sitemapArticles(1, NEWS_MAX, since);
  const urls = articles.map(
    (a) => `<url><loc>${loc(a.slug)}</loc>
<news:news>
<news:publication><news:name>Harnesslink</news:name><news:language>en</news:language></news:publication>
<news:publication_date>${iso(a.publishDate)}</news:publication_date>
<news:title>${esc(a.title)}</news:title>
</news:news></url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>
`;
}

export async function archivesXml() {
  const a = await sitemapArchives();
  const paths = [
    ...a.categories.map((s) => `/category/${s}/`),
    ...a.countries.map((s) => `/country/${s}/`),
    ...a.pages.map((p) => `/${p}/`),
    ...a.writers.map((s) => `/writers/${s}/`),
    ...a.tags.map((s) => `/tag/${s}/`),
    "/directory/",
  ];
  const urls = [...new Set(paths)].map((p) => `<url><loc>${SITE}${p}</loc><changefreq>daily</changefreq></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export async function feedXml() {
  const { articles } = await listArticles(1, FEED_MAX);
  const items = articles.map(
    (a) => `<item>
<title>${esc(a.title)}</title>
<link>${loc(a.slug)}</link>
<guid isPermaLink="true">${loc(a.slug)}</guid>
<pubDate>${a.published_at ? new Date(a.published_at).toUTCString() : ""}</pubDate>
${a.author ? `<dc:creator>${esc(a.author.name)}</dc:creator>` : ""}
${a.category ? `<category>${esc(a.category.name)}</category>` : ""}
<description>${esc(a.excerpt)}</description>
</item>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>Harnesslink</title>
<link>${SITE}/</link>
<description>Harness racing's global news source.</description>
<language>en</language>
${items.join("\n")}
</channel>
</rss>
`;
}
