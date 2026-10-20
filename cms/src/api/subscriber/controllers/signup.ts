import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/subscribers/signup { email, source } — free newsletter and
// registration-wall signup. Says the same thing for new and existing emails.
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async signup(ctx: Context) {
    const body = (ctx.request.body || {}) as { email?: string; source?: string };
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) {
      ctx.status = 422;
      ctx.body = { error: 'Please enter a valid email address.' };
      return;
    }
    const exists = await strapi.db.query('api::subscriber.subscriber').findOne({ where: { email } });
    if (!exists) {
      await strapi.documents('api::subscriber.subscriber').create({
        data: { email, source: String(body.source || 'website').slice(0, 60) },
      });
    }
    ctx.status = 201;
    ctx.body = { ok: true };
  },
});
