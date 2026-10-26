import type { Core } from '@strapi/strapi';

const USER = 'plugin::users-permissions.user';

// Reader accounts: settings applied at startup. Each step only changes
// things still at Strapi's defaults, so edits made in the admin are kept.
export async function setupReaders(strapi: Core.Strapi) {
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const fromAddress = (process.env.EMAIL_FROM || 'Harnesslink <no-reply@harnesslink.com>').match(/<([^>]+)>/)?.[1] || 'no-reply@harnesslink.com';
  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });

  // Accounts are only created through the site's own forms (POST
  // /api/readers/register), never Strapi's raw /api/auth/local/register.
  const advanced = ((await store.get({ key: 'advanced' })) || {}) as Record<string, unknown>;
  const wantedAdvanced = {
    ...advanced,
    allow_register: false,
    unique_email: true,
    email_confirmation: false,
    ...(site ? { email_reset_password: `${site}/password-reset/` } : {}),
  };
  if (JSON.stringify(wantedAdvanced) !== JSON.stringify(advanced)) await store.set({ key: 'advanced', value: wantedAdvanced });

  // The reset email in Harnesslink's words (editable afterwards under
  // Settings → Users & Permissions → Email templates → Reset password).
  const email = (await store.get({ key: 'email' })) as any;
  const reset = email?.reset_password?.options;
  if (reset && reset.from?.email === 'no-reply@strapi.io') {
    reset.from = { name: 'Harnesslink', email: fromAddress };
    reset.response_email = 'office@harnesslink.com';
    reset.object = 'Your Harnesslink password';
    reset.message = [
      '<p>Hi <%= USER.firstName || "there" %>,</p>',
      '<p>Use the link below to set a new password for your Harnesslink account. It works once and expires in 2 hours.</p>',
      '<p><a href="<%= URL %>?code=<%= TOKEN %>">Set my password</a></p>',
      '<p>If you didn’t ask for this, ignore this email — your password stays the same.</p>',
      '<p>— Harnesslink</p>',
    ].join('\n');
    await store.set({ key: 'email', value: email });
  }

  // Earlier Insider sign-ups (the old Subscriber list) join the reader list.
  const subscribers = await strapi.db.query('api::subscriber.subscriber').findMany({});
  if (subscribers.length) {
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
    let moved = 0;
    for (const s of subscribers) {
      const address = String(s.email).toLowerCase();
      if (await strapi.db.query(USER).findOne({ where: { email: address } })) continue;
      moved++;
      await strapi.plugin('users-permissions').service('user').add({
        username: address,
        email: address,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: role.id,
        insider: true,
        source: s.source || 'insider-form',
        signedUpAt: s.createdAt,
        ...(s.legacyWpUserId ? { legacyWpUserId: s.legacyWpUserId } : {}),
      });
    }
    if (moved) strapi.log.info(`[readers] ${moved} earlier Insider sign-ups added to the reader list`);
  }

  // Strapi creates "Read Only" and "Full Access" API tokens on a new
  // project. Nothing uses them; a never-used Full Access token is a risk.
  await strapi.db.query('admin::api-token').deleteMany({
    where: { name: { $in: ['Read Only', 'Full Access'] }, lastUsedAt: null },
  });

  // The menu's Login item pointed at the sign-up page before sign-in existed.
  await strapi.db
    .query('plugin::navigation.navigation-item')
    .updateMany({ where: { title: 'Login', externalPath: '/subscribe/' }, data: { externalPath: '/login/' } });
}
