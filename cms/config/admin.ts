import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => {
  const site = env('SITE_URL', '').replace(/\/$/, '');
  const previewSecret = env('PREVIEW_SECRET', '');

  return {
    auth: {
      secret: env('ADMIN_JWT_SECRET')!,
      // When the CMS is served from a sub-folder (staging: /cms/), the admin's
      // login cookie must use that path or the browser never sends it back and
      // every login bounces. Inlined into the admin bundle at build time.
      cookie: {
        path: env('ADMIN_COOKIE_PATH', '/admin'),
      },
    },
    apiToken: {
      salt: env('API_TOKEN_SALT')!,
    },
    transfer: {
      token: {
        salt: env('TRANSFER_TOKEN_SALT')!,
      },
    },
    secrets: {
      encryptionKey: env('ENCRYPTION_KEY')!,
    },
    // Preview button on stories and pages: opens the draft on the website.
    // Needs SITE_URL and PREVIEW_SECRET (the same secret in the web app).
    preview: {
      enabled: !!(site && previewSecret),
      config: {
        allowedOrigins: site ? [new URL(site).origin] : [],
        handler: (uid, { documentId, status }) => {
          if (!['api::article.article', 'api::page.page'].includes(uid)) return null;
          const q = new URLSearchParams({ secret: previewSecret, uid, documentId, status: status || 'draft' });
          return `${site}/api/preview/?${q}`;
        },
      },
    },
    flags: {
      nps: env.bool('FLAG_NPS', true),
      promoteEE: env.bool('FLAG_PROMOTE_EE', true),
      docLinks: env.bool('FLAG_DOC_LINKS', true),
    },
  };
};

export default config;
