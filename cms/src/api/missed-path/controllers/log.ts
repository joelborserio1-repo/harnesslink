import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

// POST /api/missed-paths/log { path, referer } — the site's 404 page reports
// real misses here, so they can be fixed with redirects.
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async log(ctx: Context) {
    const body = (ctx.request.body || {}) as { path?: string; referer?: string };
    const path = String(body.path || '').slice(0, 500);
    if (!path.startsWith('/')) {
      ctx.status = 204;
      return;
    }
    const referer = body.referer ? String(body.referer).slice(0, 500) : undefined;
    const now = new Date();
    const existing = await strapi.db.query('api::missed-path.missed-path').findOne({ where: { path } });
    if (existing) {
      await strapi.db.connection('missed_paths').where({ id: existing.id }).increment('hits', 1);
      await strapi.db.query('api::missed-path.missed-path').update({
        where: { id: existing.id },
        data: { lastSeenAt: now, ...(referer ? { lastReferer: referer } : {}) },
      });
    } else {
      await strapi.documents('api::missed-path.missed-path').create({
        data: { path, hits: 1, lastReferer: referer, lastSeenAt: now },
      });
    }
    ctx.status = 204;
  },
});
