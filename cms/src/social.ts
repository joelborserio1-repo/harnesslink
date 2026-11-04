import type { Core } from '@strapi/strapi';

// "Share to social" — sends a story to Postiz (our self-hosted social
// scheduler, POSTIZ_URL) from the story editor's side panel. Postiz holds the
// connected Facebook / Instagram / X / LinkedIn / Threads accounts and does the
// posting; we only hand it the text, the story link and the lead photo.
//
// Anyone who can read the story can save it to Postiz as a draft. Posting now
// or scheduling is for Editors and Super Admins, and only for published
// stories (the link has to work).

const ARTICLE = 'api::article.article';
const PUBLISHERS = new Set(['strapi-super-admin', 'strapi-editor']);

const base = () => (process.env.POSTIZ_URL || '').replace(/\/$/, '');
const key = () => process.env.POSTIZ_API_KEY || '';
const site = () => (process.env.SITE_URL || 'https://harnesslink.com').replace(/\/$/, '');
const cms = () => (process.env.PUBLIC_URL || site()).replace(/\/$/, '');

async function postiz(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base()}/api/public/v1${path}`, {
    ...init,
    headers: { Authorization: key(), 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* plain-text error */
  }
  if (!res.ok) {
    const msg = body?.msg || body?.message || body?.error || (typeof body === 'string' ? body : '') || `Postiz ${res.status}`;
    const err: any = new Error(Array.isArray(msg) ? msg.join('; ') : String(msg));
    err.status = res.status;
    throw err;
  }
  return body;
}

// Settings Postiz insists on per network; everything else uses its defaults.
function settingsFor(network: string, link: string) {
  if (network === 'x') return { who_can_reply_post: 'everyone' };
  if (network.startsWith('instagram')) return { post_type: 'post', collaborators: [] };
  if (network === 'facebook') return { url: link };
  if (network.startsWith('linkedin')) return { post_as_images_carousel: false };
  return {};
}

function leadImage(doc: any): string | null {
  const u = doc?.featuredImage?.url || doc?.legacyImage?.url;
  if (!u) return null;
  return u.startsWith('http') ? u : `${cms()}${u}`;
}

export function registerSocialRoutes(strapi: Core.Strapi) {
  const checker = (ctx: any) =>
    strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model: ARTICLE });
  const canPublish = (ctx: any) => (ctx.state.user?.roles || []).some((r: any) => PUBLISHERS.has(r.code));
  const configured = () => !!(base() && key());

  const policies = ['admin::isAuthenticatedAdmin'];

  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        method: 'GET',
        path: '/hl-social/:documentId',
        config: { policies },
        handler: async (ctx: any) => {
          const doc: any = await strapi.documents(ARTICLE).findOne({
            documentId: ctx.params.documentId,
            status: 'draft',
            populate: ['featuredImage', 'legacyImage', 'createdBy'] as any,
          });
          if (!doc) return ctx.notFound();
          if (checker(ctx).cannot.read(doc)) return ctx.forbidden();
          const published = await strapi.documents(ARTICLE).findOne({ documentId: doc.documentId, status: 'published', fields: ['slug'] as any });
          const out: any = {
            configured: configured(),
            postiz: base() || null,
            canPublish: canPublish(ctx),
            published: !!published,
            link: `${site()}/${(published as any)?.slug || doc.slug}/`,
            title: doc.title,
            standfirst: doc.excerpt || '',
            image: leadImage(doc),
            channels: [],
          };
          if (out.configured) {
            try {
              const list: any[] = await postiz('/integrations');
              out.channels = (list || [])
                .filter((c) => !c.disabled)
                .map((c) => ({ id: c.id, name: c.name, network: c.identifier || c.providerIdentifier, picture: c.picture || null }));
            } catch (e) {
              out.error = `Postiz isn’t answering: ${(e as Error).message}`;
            }
          }
          ctx.body = out;
        },
      },
      {
        method: 'POST',
        path: '/hl-social/:documentId',
        config: { policies },
        handler: async (ctx: any) => {
          if (!configured()) return ctx.badRequest('Postiz isn’t connected yet (POSTIZ_URL / POSTIZ_API_KEY).');
          const { text, channels, mode = 'draft', at, withImage = true } = ctx.request.body || {};
          if (!['draft', 'schedule', 'now'].includes(mode)) return ctx.badRequest('Unknown mode.');
          if (typeof text !== 'string' || !text.trim()) return ctx.badRequest('Write something to post.');
          if (!Array.isArray(channels) || !channels.length) return ctx.badRequest('Pick at least one account.');

          const doc: any = await strapi.documents(ARTICLE).findOne({
            documentId: ctx.params.documentId,
            status: 'draft',
            populate: ['featuredImage', 'legacyImage', 'createdBy'] as any,
          });
          if (!doc) return ctx.notFound();
          if (checker(ctx).cannot.read(doc)) return ctx.forbidden();

          const published: any = await strapi.documents(ARTICLE).findOne({ documentId: doc.documentId, status: 'published', fields: ['slug'] as any });
          if (mode !== 'draft') {
            if (!canPublish(ctx)) return ctx.forbidden('Only editors can post or schedule. Save it as a Postiz draft instead.');
            if (!published) return ctx.badRequest('Publish the story first — the link won’t work until it’s live.');
          }
          let date = new Date();
          if (mode === 'schedule') {
            date = new Date(at);
            if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 60_000) return ctx.badRequest('Pick a time in the future.');
          }
          const link = `${site()}/${published?.slug || doc.slug}/`;

          try {
            const all: any[] = await postiz('/integrations');
            const byId = new Map((all || []).map((c) => [c.id, c]));
            const picked = channels.map((id: string) => byId.get(id)).filter(Boolean);
            if (picked.length !== channels.length) return ctx.badRequest('One of those accounts is no longer connected in Postiz.');

            let image: any[] = [];
            const src = withImage ? leadImage(doc) : null;
            if (src) {
              const m = await postiz('/upload-from-url', { method: 'POST', body: JSON.stringify({ url: src }) });
              if (m?.id && m?.path) image = [{ id: m.id, path: m.path }];
            }

            const result = await postiz('/posts', {
              method: 'POST',
              body: JSON.stringify({
                type: mode,
                date: date.toISOString(),
                shortLink: false,
                tags: [],
                posts: picked.map((c: any) => {
                  const network = c.identifier || c.providerIdentifier;
                  return {
                    integration: { id: c.id },
                    value: [{ content: text.trim(), image }],
                    settings: settingsFor(network, link),
                  };
                }),
              }),
            });
            strapi.log.info(`[social] ${ctx.state.user?.email} sent "${doc.title}" to Postiz (${mode}, ${picked.length} account(s))`);
            ctx.body = { ok: true, mode, count: picked.length, postiz: base(), result };
          } catch (e: any) {
            strapi.log.warn(`[social] Postiz refused "${doc.title}": ${e.message}`);
            ctx.status = e.status && e.status < 500 ? 400 : 502;
            ctx.body = { error: { message: e.message } };
          }
        },
      },
    ],
  } as any);
}
