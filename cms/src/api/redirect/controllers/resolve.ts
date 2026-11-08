import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

// Is something published at this address right now?
async function isLive(strapi: Core.Strapi, path: string): Promise<boolean> {
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return false;
  const db = strapi.db.connection;
  const live = (table: string, column: string, value: string) =>
    db(table).where(column, value).whereNotNull('published_at').first('id');
  if (await live('pages', 'path', segments.join('/'))) return true;
  if (segments.length !== 1) return false;
  return !!((await live('articles', 'slug', segments[0])) || (await live('event_pages', 'slug', segments[0])));
}

// GET /api/redirects/resolve?path=/old-slug/ — used by the site on every
// request; answers { redirect: false } or the target, and counts the hit.
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async resolve(ctx: Context) {
    const path = String(ctx.query.path || '');
    if (!path.startsWith('/')) {
      ctx.body = { redirect: false };
      return;
    }
    const variants = path.endsWith('/') ? [path, path.slice(0, -1)] : [path, `${path}/`];
    const hit = await strapi.db.connection('redirects').whereIn('from_path', variants).first();
    if (!hit) {
      ctx.body = { redirect: false };
      return;
    }
    // Like WordPress, an old-slug redirect never hides content that lives at
    // that address now: a published story, page or event page wins (238
    // stories share a slug another post once had). Only checked on a hit, so
    // ordinary requests cost nothing extra.
    if (await isLive(strapi, path)) {
      ctx.body = { redirect: false };
      return;
    }
    await strapi.db.connection('redirects').where({ id: hit.id }).increment('hits', 1);
    ctx.body = { redirect: true, location: hit.to_path, status: hit.status_code || 301 };
  },
});
