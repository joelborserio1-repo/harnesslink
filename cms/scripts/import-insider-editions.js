#!/usr/bin/env node
'use strict';

// Brings The Insider's WordPress editions across (migration/export_insider_editions.php
// output), keeping their /edition/<slug>/ addresses, then checks the Mailchimp
// archive for anything newer (the same job the 6-hourly cron runs).
//
//   node scripts/import-insider-editions.js /tmp/editions.json
//
// Safe to rerun: editions already here (by WordPress id) are left alone.
// Each edition's email is copied from its Mailchimp page.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const UID = 'api::insider-edition.insider-edition';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// "15th October 2026" / "20 August 2026" → 2026-10-15; else the post date.
function isoDate(text, fallback) {
  const m = String(text || '').match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  const mi = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (m && mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return String(fallback || '').slice(0, 10);
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node scripts/import-insider-editions.js <editions.json>');
  const editions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  app.log.level = 'warn';
  const counts = { created: 0, existing: 0, skipped: 0, failed: 0 };
  try {
    const sync = app.service('api::insider-edition.sync');
    for (const e of editions) {
      if (!e.mailchimp_url || !/^[a-z0-9][a-z0-9-]*$/.test(e.slug || '')) {
        counts.skipped++;
        console.log(`[insider] skipped wp ${e.id} "${e.title}" (no Mailchimp link or odd slug)`);
        continue;
      }
      if (await app.db.query(UID).findOne({ where: { $or: [{ legacyWpId: e.id }, { slug: e.slug }] }, select: ['id'] })) {
        counts.existing++;
        continue;
      }
      try {
        await sync.copy({
          title: e.title,
          slug: e.slug,
          date: isoDate(e.edition_date, e.post_date_gmt),
          url: e.mailchimp_url,
          sentAt: e.post_date_gmt ? new Date(`${e.post_date_gmt.replace(' ', 'T')}Z`).toISOString() : null,
          legacyWpId: e.id,
          seo: e.seo_title || e.seo_description ? { metaTitle: e.seo_title || null, metaDescription: e.seo_description || null } : null,
        });
        counts.created++;
      } catch (err) {
        counts.failed++;
        console.error(`[insider] wp ${e.id} "${e.title}": ${err.message}`);
      }
    }
    console.log(`[insider] WordPress editions done ${JSON.stringify(counts)} of ${editions.length}`);
    const newer = await sync.run();
    console.log(`[insider] Mailchimp archive: ${newer.created} newer edition(s) added`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
