// Reader accounts are Strapi's built-in Users & Permissions users, shown in
// the admin as "Reader". The fields below are ours; email, password, blocked
// and role are Strapi's own.
export default (plugin: any) => {
  const schema = plugin.contentTypes.user.schema;
  schema.info.displayName = 'Reader';
  schema.info.description = 'A reader account (sign-in, The Insider). Staff log in separately.';
  Object.assign(schema.attributes, {
    firstName: { type: 'string', maxLength: 80 },
    lastName: { type: 'string', maxLength: 80 },
    // Gets The Insider (kept in step with the Mailchimp audience).
    insider: { type: 'boolean', default: false },
    // Where they signed up: wall, register, insider-form, wordpress…
    source: { type: 'string', maxLength: 60 },
    signedUpAt: { type: 'datetime' },
    lastSignInAt: { type: 'datetime' },
    // Migrated WordPress readers: their WordPress id, and their WordPress
    // password hash until their first sign-in converts it (then cleared).
    legacyWpUserId: { type: 'biginteger', unique: true },
    legacyPasswordHash: { type: 'string', private: true, configurable: false },
    // When the current password-reset link was sent (links last 2 hours).
    resetRequestedAt: { type: 'datetime', private: true, configurable: false },
  });
  return plugin;
};
