import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::event-page.event-page', ({ strapi }) => ({
  // GET /api/event-pages/:slug/odds — the TAB snapshot (or backup prices).
  async odds(ctx) {
    const slug = String(ctx.params.slug || '');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return ctx.notFound();
    const odds = await (strapi.service('api::event-page.odds') as any).forPage(slug);
    if (!odds) return ctx.notFound();
    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = odds;
  },
}));
