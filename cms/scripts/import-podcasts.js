#!/usr/bin/env node
'use strict';

// The Final Qtr podcast: WordPress "podcast" posts → Strapi Pages at
// podcasts/<slug> (the same /podcasts/<slug>/ address as the live site).
// Input is a read-only export (wp eval-file, see migration notes): a JSON list
// of { id, slug, title, date, audio, episode, duration, author }.
//
//   node scripts/import-podcasts.js podcasts.json [--dry-run]
//
// Idempotent: an episode already imported (same legacyWpId) is updated.
// The two "sample" episodes on the live site are test posts and are skipped.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const SKIP = new Set(['sample-episode', 'sample-video-episode']);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function longDate(sql) {
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function bodyFor(e) {
  const meta = [`Episode ${Number(e.episode) || e.episode}`, e.duration && e.duration.toLowerCase(), longDate(e.date), e.author]
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  return [
    `<p>${meta}</p>`,
    `<audio controls preload="none" src="${esc(e.audio)}"></audio>`,
    `<p><a href="${esc(e.audio)}">Download the episode (MP3)</a></p>`,
  ].join('\n');
}

async function main() {
  const file = process.argv[2];
  const dry = process.argv.includes('--dry-run');
  if (!file) throw new Error('usage: import-podcasts.js podcasts.json [--dry-run]');
  const episodes = JSON.parse(fs.readFileSync(file, 'utf8')).filter((e) => !SKIP.has(e.slug) && e.audio);

  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  const pages = app.documents('api::page.page');
  try {
    for (const e of episodes) {
      const data = {
        title: e.title,
        path: `podcasts/${e.slug}`,
        bodyFormat: 'legacy_html',
        bodyHtml: bodyFor(e),
        modifiedDate: new Date(`${e.modified.replace(' ', 'T')}Z`).toISOString(),
        legacyWpId: e.id,
        seo: { metaDescription: `${e.title}: The Final Qtr, the Harnesslink harness racing podcast. ${e.duration ? `${e.duration.trim()}.` : ''}`.trim() },
      };
      const existing = await pages.findFirst({ filters: { legacyWpId: e.id }, status: 'draft', fields: ['documentId'] });
      if (dry) {
        console.error(`${existing ? 'update' : 'create'} /${data.path}/`);
        continue;
      }
      const doc = existing
        ? await pages.update({ documentId: existing.documentId, data })
        : await pages.create({ data });
      await pages.publish({ documentId: doc.documentId });
      console.error(`${existing ? 'updated' : 'created'} /${data.path}/`);
    }
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(`[import-podcasts] failed: ${err.message}`);
  process.exit(1);
});
