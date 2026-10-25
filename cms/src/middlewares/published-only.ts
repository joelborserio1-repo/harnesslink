import type { Core } from '@strapi/strapi';

// Strapi lets anyone who can list stories ask for drafts with ?status=draft,
// which would expose embargoed and unfinished stories to the public. Drafts
// are only for the admin and for requests carrying an API token (the
// website's preview); everything else gets a 403.
export default (_config: unknown, _ctx: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
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
