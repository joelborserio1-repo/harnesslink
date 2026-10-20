import type { Core } from '@strapi/strapi';
import cronTasks from './cron-tasks';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Public URL of the CMS (admin panel, uploaded media). Set PUBLIC_URL in
  // production, e.g. https://cms.harnesslink.com
  url: env('PUBLIC_URL', ''),
  app: {
    keys: env.array('APP_KEYS')!,
  },
  // Behind nginx (HTTPS terminated there): trust X-Forwarded-* so the admin's
  // secure login cookie and generated URLs are right.
  proxy: { koa: env.bool('IS_PROXIED', false) },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  cron: {
    enabled: env.bool('CRON_ENABLED', true),
    tasks: cronTasks,
  },
});

export default config;
