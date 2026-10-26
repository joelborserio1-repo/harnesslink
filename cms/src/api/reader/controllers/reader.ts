import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

const USER = 'plugin::users-permissions.user';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const RESET_LINK_MS = 2 * 60 * 60 * 1000;

// Failed sign-ins per email address: 8 per 15 minutes, then a pause.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
function tooMany(email: string) {
  const f = failures.get(email);
  return !!f && f.until > Date.now() && f.count >= 8;
}
function failed(email: string) {
  const f = failures.get(email);
  if (!f || f.until < Date.now()) failures.set(email, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count += 1;
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const accounts = () => strapi.service('api::reader.accounts') as any;
  const mailchimp = () => strapi.service('api::reader.mailchimp') as any;

  const fail = (ctx: Context, status: number, code: string, message: string) => {
    ctx.status = status;
    ctx.body = { error: { code, message } };
  };

  const session = async (ctx: Context, reader: any) => {
    const fresh = await strapi.db.query(USER).findOne({ where: { id: reader.id } });
    ctx.body = { token: accounts().issue(fresh), reader: accounts().profile(fresh) };
  };

  return {
    // POST /api/readers/register { email, password, firstName, lastName, insider, source }
    async register(ctx: Context) {
      const body = (ctx.request.body || {}) as Record<string, unknown>;
      if (body.website) return fail(ctx, 400, 'invalid', 'Something went wrong.'); // honeypot
      const email = accounts().normaliseEmail(body.email);
      const password = String(body.password || '');
      const firstName = clean(body.firstName, 80);
      if (!EMAIL.test(email) || email.length > 254) return fail(ctx, 422, 'email', 'Please enter a valid email address.');
      if (password.length < MIN_PASSWORD) return fail(ctx, 422, 'password', `Use at least ${MIN_PASSWORD} characters for your password.`);
      if (!firstName) return fail(ctx, 422, 'name', 'Please enter your first name.');

      const existing = await accounts().find(email);
      if (existing) {
        if (existing.password || existing.legacyPasswordHash) {
          return fail(ctx, 409, 'exists', 'You already have an account — sign in instead.');
        }
        // Signed up for The Insider before, but never set a password: prove
        // it's their inbox before letting anyone set one.
        await accounts().sendReset(existing);
        return fail(ctx, 409, 'set-password', 'We’ve emailed you a link to set your password.');
      }

      const insider = body.insider !== false;
      const reader = await strapi.plugin('users-permissions').service('user').add({
        username: email,
        email,
        password,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: await accounts().readerRoleId(),
        firstName,
        lastName: clean(body.lastName, 80) || null,
        insider,
        source: clean(body.source, 60) || 'register',
        signedUpAt: new Date(),
        lastSignInAt: new Date(),
      });
      if (insider) mailchimp().sync({ email, firstName, lastName: reader.lastName, subscribed: true, tag: reader.source });
      ctx.status = 201;
      await session(ctx, reader);
    },

    // POST /api/readers/login { email, password }
    async login(ctx: Context) {
      const body = (ctx.request.body || {}) as Record<string, unknown>;
      const email = accounts().normaliseEmail(body.email);
      const password = String(body.password || '');
      if (tooMany(email)) return fail(ctx, 429, 'too-many', 'Too many attempts — wait 15 minutes or reset your password.');
      const reader = email && password ? await accounts().find(email) : null;
      if (!reader) {
        failed(email);
        return fail(ctx, 401, 'wrong', 'That email and password don’t match.');
      }
      if (reader.blocked) return fail(ctx, 403, 'blocked', 'This account is closed. Contact office@harnesslink.com.');
      const result = await accounts().checkPassword(reader, password);
      if (result === 'no-password') {
        await accounts().sendReset(reader);
        return fail(ctx, 409, 'set-password', 'Your account has no password yet — we’ve emailed you a link to set one.');
      }
      if (result === 'wrong') {
        failed(email);
        return fail(ctx, 401, 'wrong', 'That email and password don’t match.');
      }
      failures.delete(email);
      await strapi.db.query(USER).update({ where: { id: reader.id }, data: { lastSignInAt: new Date() } });
      await session(ctx, reader);
    },

    // POST /api/readers/refresh (Bearer) — a fresh 30-day token.
    async refresh(ctx: Context) {
      const reader = await accounts().fromToken(ctx.get('authorization'));
      if (!reader) return fail(ctx, 401, 'signed-out', 'Please sign in again.');
      await strapi.db.query(USER).update({ where: { id: reader.id }, data: { lastSignInAt: new Date() } });
      await session(ctx, reader);
    },

    // GET /api/readers/me (Bearer)
    async me(ctx: Context) {
      const reader = await accounts().fromToken(ctx.get('authorization'));
      if (!reader) return fail(ctx, 401, 'signed-out', 'Please sign in again.');
      ctx.body = { reader: accounts().profile(reader) };
    },

    // PUT /api/readers/me (Bearer) { firstName, lastName, insider }
    async update(ctx: Context) {
      const reader = await accounts().fromToken(ctx.get('authorization'));
      if (!reader) return fail(ctx, 401, 'signed-out', 'Please sign in again.');
      const body = (ctx.request.body || {}) as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      if (body.firstName !== undefined) data.firstName = clean(body.firstName, 80) || reader.firstName;
      if (body.lastName !== undefined) data.lastName = clean(body.lastName, 80) || null;
      if (typeof body.insider === 'boolean') data.insider = body.insider;
      const updated = await strapi.db.query(USER).update({ where: { id: reader.id }, data });
      if (typeof body.insider === 'boolean' && body.insider !== !!reader.insider) {
        mailchimp().sync({ email: updated.email, firstName: updated.firstName, lastName: updated.lastName, subscribed: body.insider, tag: 'my-account' });
      }
      ctx.body = { reader: accounts().profile(updated) };
    },

    // POST /api/readers/forgot-password { email } — always says the same thing.
    async forgotPassword(ctx: Context) {
      const email = accounts().normaliseEmail((ctx.request.body as any)?.email);
      const reader = EMAIL.test(email) ? await accounts().find(email) : null;
      if (reader && !reader.blocked) {
        try {
          await accounts().sendReset(reader);
        } catch (err) {
          strapi.log.error(`[readers] reset email failed: ${(err as Error).message}`);
        }
      }
      ctx.body = { ok: true };
    },

    // POST /api/readers/reset-password { code, password } — signs them in.
    async resetPassword(ctx: Context) {
      const body = (ctx.request.body || {}) as Record<string, unknown>;
      const code = String(body.code || '');
      const password = String(body.password || '');
      if (password.length < MIN_PASSWORD) return fail(ctx, 422, 'password', `Use at least ${MIN_PASSWORD} characters for your password.`);
      const reader = /^[a-f0-9]{64}$/.test(code)
        ? await strapi.db.query(USER).findOne({ where: { resetPasswordToken: code } })
        : null;
      const fresh = reader?.resetRequestedAt && Date.now() - new Date(reader.resetRequestedAt).getTime() < RESET_LINK_MS;
      if (!reader || reader.blocked || !fresh) return fail(ctx, 400, 'expired', 'That link has expired — ask for a new one.');
      await accounts().setPassword(reader.id, password);
      await strapi.db.query(USER).update({ where: { id: reader.id }, data: { resetPasswordToken: null, resetRequestedAt: null, lastSignInAt: new Date() } });
      failures.delete(reader.email);
      await session(ctx, reader);
    },
  };
};
