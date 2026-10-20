import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

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
    await strapi.db.connection('redirects').where({ id: hit.id }).increment('hits', 1);
    ctx.body = { redirect: true, location: hit.to_path, status: hit.status_code || 301 };
  },
});
