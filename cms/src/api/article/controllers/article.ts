import { factories } from '@strapi/strapi';

// Stories created or edited through the public API (API tokens: the story
// generator) are always drafts. Strapi's REST default is to publish on create
// and update unless the caller adds ?status=draft; here status is forced to
// draft, so publishing stays a human action in the admin (which uses the
// Content Manager's own routes, not these).
export default factories.createCoreController('api::article.article', () => ({
  async create(ctx) {
    // Strapi doesn't enforce "unique" on draft create, so check here: a story
    // already at this address (slug), or a partner story already republished
    // (syndicationUrl), is refused with 409 and the existing documentId.
    const data = (ctx.request.body as any)?.data ?? {};
    for (const field of ['slug', 'syndicationUrl'] as const) {
      const value = typeof data[field] === 'string' ? data[field].trim() : '';
      if (!value) continue;
      const existing = await strapi.db
        .query('api::article.article')
        .findOne({ where: { [field]: value }, select: ['documentId'] });
      if (existing) {
        ctx.status = 409;
        ctx.body = {
          data: null,
          error: { status: 409, name: 'ConflictError', message: `A story with this ${field} already exists`, details: { field, documentId: existing.documentId } },
        };
        return;
      }
    }
    ctx.query = { ...ctx.query, status: 'draft' };
    return super.create(ctx);
  },
  async update(ctx) {
    ctx.query = { ...ctx.query, status: 'draft' };
    return super.update(ctx);
  },
}));
