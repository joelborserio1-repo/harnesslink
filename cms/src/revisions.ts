import { createHash } from 'node:crypto';
import type { Core } from '@strapi/strapi';

// Story revisions — Strapi's Content History is a paid feature, so we keep
// our own. Every time staff save, publish or restore a story, the resulting
// headline, standfirst, URL and body are stored (unchanged saves are
// skipped), with who did it. The last KEEP versions per story are kept.
// Imports and other scripts (no signed-in admin) don't create revisions.
// Read and restore through the "Revisions" panel in the story editor.

const ARTICLE = 'api::article.article';
const REVISION = 'api::story-revision.story-revision';
const KEEP = 50;
const FIELDS = ['title', 'subtitle', 'excerpt', 'slug', 'bodyHtml'] as const;
const KINDS: Record<string, 'saved' | 'published'> = { create: 'saved', update: 'saved', publish: 'published' };

type Snapshot = Partial<Record<(typeof FIELDS)[number], string | null>>;

const hashOf = (s: Snapshot) => createHash('sha256').update(JSON.stringify(FIELDS.map((f) => s[f] ?? ''))).digest('hex');

async function record(strapi: Core.Strapi, documentId: string, kind: 'saved' | 'published' | 'restored', user: any) {
  const draft = (await strapi.documents(ARTICLE).findOne({ documentId, status: 'draft', fields: [...FIELDS] as any })) as Snapshot | null;
  if (!draft) return;
  const contentHash = hashOf(draft);
  const last = await strapi.db.query(REVISION).findOne({
    where: { articleDocumentId: documentId },
    orderBy: { createdAt: 'desc' },
    select: ['contentHash', 'kind'],
  });
  // Same text as the last version: only worth a row if it's now been published.
  if (last?.contentHash === contentHash && !(kind === 'published' && last.kind !== 'published')) return;

  await strapi.db.query(REVISION).create({
    data: {
      articleDocumentId: documentId,
      kind,
      ...Object.fromEntries(FIELDS.map((f) => [f, draft[f] ?? null])),
      editorName: [user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.username || user?.email || null,
      editorEmail: user?.email ?? null,
      contentHash,
    },
  });

  const older = await strapi.db.query(REVISION).findMany({
    where: { articleDocumentId: documentId },
    orderBy: { createdAt: 'desc' },
    offset: KEEP,
    select: ['id'],
  });
  if (older.length) await strapi.db.query(REVISION).deleteMany({ where: { id: { $in: older.map((r: any) => r.id) } } });
}

export function registerRevisionCapture(strapi: Core.Strapi) {
  strapi.documents.use(async (ctx, next) => {
    const result = await next();
    const kind = KINDS[ctx.action];
    if (ctx.uid !== ARTICLE || !kind) return result;
    const state = strapi.requestContext.get()?.state;
    const user = state?.user;
    if (!user?.email || user.provider || state?.hlRestoring) return result; // admins only (readers have a provider); restores record themselves
    const documentId = (ctx.params as any)?.documentId || (result as any)?.documentId;
    if (documentId) {
      record(strapi, documentId, kind, user).catch((e) => strapi.log.warn(`[revisions] ${e.message}`));
    }
    return result;
  });
}

// Admin routes behind the Revisions panel. Seeing and restoring revisions
// needs the same rights as reading / editing that story (Authors: own only).
export function registerRevisionRoutes(strapi: Core.Strapi) {
  const checker = (ctx: any) =>
    strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model: ARTICLE });

  const article = (documentId: string) =>
    strapi.documents(ARTICLE).findOne({ documentId, status: 'draft', populate: ['createdBy'] as any });

  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        method: 'GET',
        path: '/hl-revisions/:documentId',
        handler: async (ctx: any) => {
          const doc = await article(ctx.params.documentId);
          if (!doc) return ctx.notFound();
          if (checker(ctx).cannot.read(doc)) return ctx.forbidden();
          ctx.body = {
            revisions: await strapi.db.query(REVISION).findMany({
              where: { articleDocumentId: ctx.params.documentId },
              orderBy: { createdAt: 'desc' },
              select: ['id', 'kind', 'title', 'editorName', 'createdAt'],
            }),
          };
        },
        config: { policies: ['admin::isAuthenticatedAdmin'] },
      },
      {
        method: 'GET',
        path: '/hl-revisions/item/:id',
        handler: async (ctx: any) => {
          const rev = await strapi.db.query(REVISION).findOne({ where: { id: Number(ctx.params.id) } });
          if (!rev) return ctx.notFound();
          const doc = await article(rev.articleDocumentId);
          if (!doc || checker(ctx).cannot.read(doc)) return ctx.forbidden();
          ctx.body = { revision: { ...rev, editorEmail: undefined, contentHash: undefined } };
        },
        config: { policies: ['admin::isAuthenticatedAdmin'] },
      },
      {
        method: 'POST',
        path: '/hl-revisions/item/:id/restore',
        handler: async (ctx: any) => {
          const rev = await strapi.db.query(REVISION).findOne({ where: { id: Number(ctx.params.id) } });
          if (!rev) return ctx.notFound();
          const doc = await article(rev.articleDocumentId);
          if (!doc || checker(ctx).cannot.update(doc)) return ctx.forbidden();
          // Restores into the draft; publishing it stays a separate, deliberate step.
          ctx.state.hlRestoring = true;
          await strapi.documents(ARTICLE).update({
            documentId: rev.articleDocumentId,
            data: Object.fromEntries(FIELDS.map((f) => [f, rev[f]])) as any,
          });
          await record(strapi, rev.articleDocumentId, 'restored', ctx.state.user);
          ctx.body = { ok: true };
        },
        config: { policies: ['admin::isAuthenticatedAdmin'] },
      },
    ],
  } as any);
}
