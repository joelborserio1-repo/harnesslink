#!/usr/bin/env node
'use strict';

// Imports WordPress readers (migration/export_readers.php output) as Strapi
// reader accounts:
//
//   node scripts/import-readers.js /tmp/readers.json
//
// - Keeps their WordPress password hash; their first sign-in on the new site
//   checks it and converts it (see src/api/reader/services/accounts.ts).
// - Safe to rerun: an email that already has an account is left alone apart
//   from recording its WordPress id.
// - Doesn't touch Mailchimp: whether they get The Insider stays in Mailchimp.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const USER = 'plugin::users-permissions.user';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node scripts/import-readers.js <readers.json>');
  const readers = JSON.parse(fs.readFileSync(file, 'utf8'));

  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  const counts = { created: 0, linked: 0, skipped: 0, failed: 0 };
  try {
    const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
    for (const r of readers) {
      const email = String(r.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        counts.skipped++;
        continue;
      }
      try {
        const existing = await app.db.query(USER).findOne({ where: { email } });
        if (existing) {
          if (!existing.legacyWpUserId) {
            await app.db.query(USER).update({ where: { id: existing.id }, data: { legacyWpUserId: r.id } });
            counts.linked++;
          } else counts.skipped++;
          continue;
        }
        const data = {
          username: email,
          email,
          provider: 'local',
          confirmed: true,
          blocked: false,
          role: role.id,
          firstName: r.first_name || null,
          lastName: r.last_name || null,
          insider: false,
          source: 'wordpress',
          signedUpAt: r.registered ? new Date(r.registered) : null,
          legacyWpUserId: r.id,
          legacyPasswordHash: typeof r.pass === 'string' && r.pass.startsWith('$wp$2') ? r.pass : null,
        };
        try {
          await app.documents(USER).create({ data });
        } catch (err) {
          // A handful of WordPress addresses fail Strapi's stricter email check
          // ("a..b@gmail.com" — Gmail delivers them). Keep them exactly as
          // they are so those readers can still sign in.
          if (!/email must be a valid email/.test(err.message)) throw err;
          const now = new Date();
          await app.db.query(USER).create({ data: { ...data, createdAt: now, updatedAt: now, publishedAt: now } });
        }
        counts.created++;
      } catch (err) {
        counts.failed++;
        console.error(`[readers] wp user ${r.id}: ${err.message}`);
      }
    }
    console.log(`[readers] done — ${JSON.stringify(counts)} of ${readers.length}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
