#!/usr/bin/env node
'use strict';

// One-off: decode HTML entities ("Terms &amp; Conditions") left in plain-text
// fields by earlier imports. The importer now decodes these itself
// (wordpress-mapper.js decodeEntities). Story bodies are HTML and untouched.
//
//   node scripts/fix-entities.js [--dry-run] > backup.json
//
// Prints the rows it changes (before and after) as JSON, so it can be undone.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');
const { decodeEntities } = require('./wordpress-mapper');

const FIELDS = {
  articles: ['title', 'subtitle', 'excerpt'],
  pages: ['title'],
  tags: ['name'],
  categories: ['name'],
  authors: ['name'],
  components_shared_seos: ['meta_title', 'meta_description', 'og_title', 'og_description', 'twitter_title', 'twitter_description'],
};
const HAS_ENTITY = '&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z]+);';

async function main() {
  const dry = process.argv.includes('--dry-run');
  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  const db = app.db.connection;
  const changes = [];
  try {
    for (const [table, cols] of Object.entries(FIELDS)) {
      const rows = await db(table)
        .select(['id', ...cols])
        .where((q) => cols.forEach((c) => q.orWhereRaw(`?? ~ ?`, [c, HAS_ENTITY])));
      for (const row of rows) {
        const update = {};
        for (const c of cols) {
          const fixed = decodeEntities(row[c]);
          if (fixed !== row[c]) update[c] = fixed;
        }
        if (!Object.keys(update).length) continue;
        changes.push({ table, id: row.id, before: Object.fromEntries(Object.keys(update).map((c) => [c, row[c]])), after: update });
        if (!dry) await db(table).where({ id: row.id }).update(update);
      }
    }
    process.stdout.write(JSON.stringify(changes, null, 1) + '\n');
    console.error(`[fix-entities] ${changes.length} rows ${dry ? 'would change' : 'changed'}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(`[fix-entities] failed: ${err.message}`);
  process.exit(1);
});
