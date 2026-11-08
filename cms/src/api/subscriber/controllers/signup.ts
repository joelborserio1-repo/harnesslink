import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER = 'plugin::users-permissions.user';

// POST /api/subscribers/signup { firstName, lastName, email, source } — The Insider sign-up forms.
// Adds the email to the reader list (no password yet; they can set one later
// from the sign-in page) and to the Mailchimp audience. Says the same thing
// for new and existing emails.
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async signup(ctx: Context) {
    const body = (ctx.request.body || {}) as { email?: string; firstName?: string; lastName?: string; source?: string; website?: string };
    const clean = (v: unknown) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    if (body.website) {
      ctx.status = 201;
      ctx.body = { ok: true };
      return;
    }
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) {
      ctx.status = 422;
      ctx.body = { error: 'Please enter a valid email address.' };
      return;
    }
    if (!firstName || !lastName) {
      ctx.status = 422;
      ctx.body = { error: 'Please enter your first and last name.' };
      return;
    }
    const source = String(body.source || 'insider-form').slice(0, 60);
    const accounts = strapi.service('api::reader.accounts') as any;
    const existing = await accounts.find(email);
    if (existing) {
      // Turn The Insider on and fill in a missing name; never overwrite one.
      const data: Record<string, unknown> = {};
      if (!existing.insider) data.insider = true;
      if (!existing.firstName) data.firstName = firstName;
      if (!existing.lastName) data.lastName = lastName;
      if (Object.keys(data).length) await strapi.db.query(USER).update({ where: { id: existing.id }, data });
    } else {
      await strapi.plugin('users-permissions').service('user').add({
        username: email,
        email,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: await accounts.readerRoleId(),
        insider: true,
        firstName,
        lastName,
        source,
        signedUpAt: new Date(),
      });
    }
    (strapi.service('api::reader.mailchimp') as any).sync({
      email,
      firstName: existing?.firstName || firstName,
      lastName: existing?.lastName || lastName,
      subscribed: true,
      tag: source,
    });
    ctx.status = 201;
    ctx.body = { ok: true };
  },
});
