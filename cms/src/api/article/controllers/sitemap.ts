import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

const MAX_PER_PAGE = 10_000;

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  // GET /api/sitemap/articles?page=1&perPage=10000[&since=ISO]
  // → { total, articles: [{ slug, title, publishDate, lastmod }] }, oldest first
  //   (or newest first when `since` is given, for the Google News sitemap).
  async articles(ctx: Context) {
    const db = strapi.db.connection;
    const perPage = Math.min(Math.max(Number(ctx.query.perPage) || MAX_PER_PAGE, 1), MAX_PER_PAGE);
    const page = Math.max(Number(ctx.query.page) || 1, 1);
    const since = ctx.query.since ? new Date(String(ctx.query.since)) : null;

    const live = db('articles').whereNotNull('published_at');
    if (since && !Number.isNaN(since.getTime())) live.where('publish_date', '>=', since.toISOString());

    const [{ count }] = await live.clone().count({ count: '*' });
    const rows = await live
      .clone()
      .select('slug', 'title', 'publish_date', 'modified_date', 'updated_at', 'published_at')
      .orderBy(since ? [{ column: 'publish_date', order: 'desc' }] : [{ column: 'id', order: 'asc' }])
      .offset((page - 1) * perPage)
      .limit(perPage);

    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = {
      total: Number(count),
      articles: rows.map((r: Record<string, unknown>) => ({
        slug: r.slug,
        title: r.title,
        publishDate: r.publish_date ?? r.published_at,
        lastmod: r.modified_date ?? r.updated_at ?? r.publish_date,
      })),
    };
  },

  // GET /api/sitemap/archives → the archive URLs that exist: categories,
  // countries, published pages, and writers/tags that have live stories.
  async archives(ctx: Context) {
    const db = strapi.db.connection;
    const categories = await db('categories').select('slug').orderBy('id');
    const countries = await db('countries')
      .join('countries_category_lnk as l', 'l.country_id', 'countries.id')
      .join('categories as c', 'c.id', 'l.category_id')
      .select('c.slug')
      .orderBy('countries.position');
    const pages = await db('pages').whereNotNull('published_at').select('path').orderBy('path');
    const writers = await db('authors as a')
      .join('articles_authors_lnk as l', 'l.author_id', 'a.id')
      .join('articles as ar', 'ar.id', 'l.article_id')
      .whereNotNull('ar.published_at')
      .distinct('a.slug')
      .orderBy('a.slug');
    const tags = await db('tags as t')
      .join('articles_tags_lnk as l', 'l.tag_id', 't.id')
      .join('articles as ar', 'ar.id', 'l.article_id')
      .whereNotNull('ar.published_at')
      .distinct('t.slug')
      .orderBy('t.slug');

    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = {
      categories: categories.map((r: { slug: string }) => r.slug),
      countries: countries.map((r: { slug: string }) => r.slug),
      pages: pages.map((r: { path: string }) => r.path),
      writers: writers.map((r: { slug: string }) => r.slug),
      tags: tags.map((r: { slug: string }) => r.slug),
    };
  },
});
