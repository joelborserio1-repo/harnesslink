import { timingSafeEqual } from 'node:crypto';
import type { Context } from 'koa';

// Preview: the admin's Preview button opens the website, which asks here for
// the draft. Only callers holding PREVIEW_SECRET get drafts.
const COLLECTIONS = {
  articles: 'api::article.article',
  pages: 'api::page.page',
} as const;

function authorised(ctx: Context): boolean {
  const secret = process.env.PREVIEW_SECRET || '';
  const given = String(ctx.get('x-preview-secret') || '');
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export default {
  // GET /api/preview/target?uid=api::article.article&documentId=… → { path }
  // Where the draft lives on the site (its slug or page path).
  async target(ctx: Context) {
    if (!authorised(ctx)) return ctx.forbidden();
    const uid = String(ctx.query.uid || '');
    const documentId = String(ctx.query.documentId || '');
    if (uid === COLLECTIONS.articles) {
      const doc = await strapi.documents(uid).findOne({ documentId, status: 'draft', fields: ['slug'] });
      return doc?.slug ? { path: `/${doc.slug}/` } : ctx.notFound();
    }
    if (uid === COLLECTIONS.pages) {
      const doc = await strapi.documents(uid).findOne({ documentId, status: 'draft', fields: ['path'] });
      return doc?.path ? { path: `/${String(doc.path).replace(/^\/|\/$/g, '')}/` } : ctx.notFound();
    }
    return ctx.badRequest('Preview is set up for stories and pages only.');
  },

  // GET /api/preview/articles?filters…&populate… → { data: [draft] }
  // Same query shape as the public list, answered from the drafts.
  async find(ctx: Context) {
    if (!authorised(ctx)) return ctx.forbidden();
    const uid = COLLECTIONS[ctx.params.collection as keyof typeof COLLECTIONS];
    if (!uid) return ctx.notFound();
    const { filters, populate, fields } = ctx.query as Record<string, any>;
    const data = await strapi.documents(uid).findMany({ filters, populate, fields, status: 'draft', limit: 1 } as never);
    return { data };
  },
};
