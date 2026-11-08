import { timingSafeEqual } from 'node:crypto';
import type { Core } from '@strapi/strapi';

// Reader comments are posted by the website on behalf of a signed-in reader
// (it checks the session and fills in their name). Direct posts to the
// public comments API are refused unless they carry the site's shared secret.
const siteSecret = () => process.env.PREVIEW_SECRET || '';
const fromSite = (header: unknown) => {
  const want = Buffer.from(siteSecret());
  const got = Buffer.from(String(header || ''));
  return want.length > 0 && got.length === want.length && timingSafeEqual(got, want);
};

// Strapi lets anyone who can list stories ask for drafts with ?status=draft,
// which would expose embargoed and unfinished stories to the public. Drafts
// are only for the admin and for requests carrying an API token (the
// website's preview); everything else gets a 403.
export default (_config: unknown, _ctx: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'POST' && ctx.path.startsWith('/api/comments/') && siteSecret() && !fromSite(ctx.request.header['x-hl-site'])) {
      ctx.status = 403;
      ctx.body = { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Sign in on harnesslink.com to comment.' } };
      return;
    }
    if (ctx.path.startsWith('/api/') && !ctx.request.header.authorization) {
      const status = ctx.query?.status;
      if (status !== undefined && status !== 'published') {
        ctx.status = 403;
        ctx.body = { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Drafts are not public.' } };
        return;
      }
    }
    await next();
  };
};
