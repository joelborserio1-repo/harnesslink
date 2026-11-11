import { factories } from '@strapi/strapi';

// Stories created or edited through the public API (API tokens: the story
// generator) are always drafts. Strapi's REST default is to publish on create
// and update unless the caller adds ?status=draft; here status is forced to
// draft, so publishing stays a human action in the admin (which uses the
// Content Manager's own routes, not these).
export default factories.createCoreController('api::article.article', () => ({
  async create(ctx) {
    ctx.query = { ...ctx.query, status: 'draft' };
    return super.create(ctx);
  },
  async update(ctx) {
    ctx.query = { ...ctx.query, status: 'draft' };
    return super.update(ctx);
  },
}));
