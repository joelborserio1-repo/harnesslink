// Lean, read-only listings for the sitemaps and feed (slugs and dates only).
// The regular REST API caps pages at 100 entries; a sitemap page holds 10,000.
export default {
  routes: [
    { method: 'GET', path: '/sitemap/articles', handler: 'sitemap.articles', config: { auth: false } },
    { method: 'GET', path: '/sitemap/archives', handler: 'sitemap.archives', config: { auth: false } },
  ],
};
