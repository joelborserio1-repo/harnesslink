#!/usr/bin/env node
'use strict';

// (Re)builds the site-search index from every published story, and switches
// on the plugin's live sync so later edits update the index by themselves.
// Same as ticking "article" on the Meilisearch page in the admin, but it can
// run from the server's shell:
//
//   node scripts/index-search.js
//
// Needs MEILI_HOST and MEILI_MASTER_KEY in the environment.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const UID = 'api::article.article';

async function main() {
  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  try {
    const meili = app.plugin('meilisearch');
    if (!meili) throw new Error('Meilisearch plugin is off — set MEILI_HOST.');
    const started = Date.now();
    // Re-adding replaces documents with the same id, so this is safe to rerun.
    const tasks = await meili.service('meilisearch').addContentTypeInMeiliSearch({ contentType: UID });
    console.log(`${tasks.length} batches sent to Meilisearch`);
    console.log(`queued all published stories for indexing in ${Math.round((Date.now() - started) / 1000)}s`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
