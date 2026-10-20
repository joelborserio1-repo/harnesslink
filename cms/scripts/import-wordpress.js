#!/usr/bin/env node
'use strict';

// Loads a migration/export_posts.php export into Strapi.
//
//   node scripts/import-wordpress.js ../tmp/export-1000.json
//   node scripts/import-wordpress.js --pages ../tmp/export-pages.json [--only privacy-policy,terms-conditions]
//   (several files at once: node scripts/import-wordpress.js posts-1.json posts-2.json …)
//
// - Idempotent: keyed on legacyWpId; re-running updates rather than duplicates.
// - Resumable: an unchanged post (same WordPress modified time) is skipped.
// - Additive: never deletes.
// - Every article is published with its original WordPress dates.
// Run with Strapi stopped or running — it boots its own instance.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');
const { mapArticle, mapPage, UID_SAFE } = require('./wordpress-mapper');

// Pages we carry over as static HTML. The rest are features rebuilt natively
// (directory, race calendars, The Eureka, login…) or test pages.
const DEFAULT_PAGES = ['privacy-policy', 'disclaimers', 'terms-conditions', 'a-pilgrimage-to-france'];

const args = process.argv.slice(2);
const pagesMode = args.includes('--pages');
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
if (files.length === 0) {
  console.error('usage: node scripts/import-wordpress.js [--pages] [--force] [--only a,b] <export.json>');
  process.exit(1);
}

async function main() {
  // In a production image the app is already compiled (and TypeScript isn't
  // installed); locally, compile first.
  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  app.log.level = 'warn';
  try {
    for (const file of files) {
      console.log(`[import] ${file}`);
      const records = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
      if (pagesMode) await importPages(app, records);
      else await importArticles(app, records);
    }
  } finally {
    await app.destroy();
  }
}

// ---------- terms & authors (cached by slug) ----------

function makeUpserter(app, uid, build) {
  const cache = new Map();
  return async (ref) => {
    if (!ref.slug || !UID_SAFE.test(ref.slug)) return null;
    if (cache.has(ref.slug)) return cache.get(ref.slug);
    let doc = await app.documents(uid).findFirst({ filters: { slug: ref.slug }, fields: ['documentId'] });
    if (!doc) doc = await app.documents(uid).create({ data: build(ref), fields: ['documentId'] });
    cache.set(ref.slug, doc.documentId);
    return doc.documentId;
  };
}

async function importArticles(app, posts) {
  const stats = { seen: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, flagged: 0, errors: 0, redirects: 0 };
  const skipped = [];
  const category = makeUpserter(app, 'api::category.category', (r) => ({
    name: r.name, slug: r.slug, kind: r.kind, legacyTermId: r.legacyTermId,
  }));
  const tag = makeUpserter(app, 'api::tag.tag', (r) => ({ name: r.name, slug: r.slug, legacyTermId: r.legacyTermId }));
  const author = makeUpserter(app, 'api::author.author', (r) => ({
    name: r.name, slug: r.slug, bio: r.bio, legacyRefs: r.refs,
  }));

  // Oldest first, so relations and redirects build up in publication order.
  posts.sort((a, b) => Number(a.id) - Number(b.id));

  for (const post of posts) {
    stats.seen += 1;
    try {
      const mapped = mapArticle(post);
      if (mapped.skip) {
        stats.skipped += 1;
        skipped.push(`${post.id}: ${mapped.skip}`);
        continue;
      }

      const existing = await app.documents('api::article.article').findFirst({
        filters: { legacyWpId: mapped.data.legacyWpId },
        fields: ['documentId', 'modifiedDate'],
      });
      if (existing && !force && existing.modifiedDate === mapped.data.modifiedDate) {
        stats.unchanged += 1;
        continue;
      }

      const categories = (await Promise.all(mapped.refs.categories.map(category))).filter(Boolean);
      // A specific region is the primary section, not "Top 4" or "International".
      const primaryRef =
        mapped.refs.categories.find((c) => c.kind === 'geographic' && c.name !== 'International') ||
        mapped.refs.categories.find((c) => c.kind === 'geographic') ||
        mapped.refs.categories[0];
      const data = {
        ...mapped.data,
        authors: (await Promise.all(mapped.refs.authors.map(author))).filter(Boolean),
        categories,
        primaryCategory: primaryRef ? await category(primaryRef) : null,
        tags: (await Promise.all(mapped.refs.tags.map(tag))).filter(Boolean),
      };

      if (existing) {
        await app.documents('api::article.article').update({ documentId: existing.documentId, data, status: 'published' });
        stats.updated += 1;
      } else {
        await app.documents('api::article.article').create({ data, status: 'published' });
        stats.created += 1;
      }
      if (mapped.flags.length) stats.flagged += 1;

      for (const old of mapped.refs.oldSlugs) {
        const from = `/${old}/`;
        if (from === mapped.data.legacyUrl) continue;
        const has = await app.db.query('api::redirect.redirect').findOne({ where: { fromPath: from } });
        if (!has) {
          await app.documents('api::redirect.redirect').create({
            data: { fromPath: from, toPath: mapped.data.legacyUrl, statusCode: 301, reason: 'wp_old_slug' },
          });
          stats.redirects += 1;
        }
      }
    } catch (e) {
      stats.errors += 1;
      console.error(`[import] post ${post.id} failed: ${e.message}${e.details ? ' ' + JSON.stringify(e.details) : ''}`);
    }
    if (stats.seen % 100 === 0) console.log(`[import] ${stats.seen}/${posts.length}`, JSON.stringify(stats));
  }
  console.log('[import] done', JSON.stringify(stats));
  if (skipped.length) console.log('[import] skipped:\n  ' + skipped.join('\n  '));
}

async function importPages(app, records) {
  const wanted = only || DEFAULT_PAGES;
  const stats = { imported: 0, skipped: 0, errors: 0 };
  for (const post of records) {
    const mapped = mapPage(post);
    if (post.post_type !== 'page' || !wanted.includes(mapped.path)) {
      stats.skipped += 1;
      continue;
    }
    try {
      const existing = await app.documents('api::page.page').findFirst({
        filters: { legacyWpId: mapped.data.legacyWpId }, fields: ['documentId'],
      });
      if (existing) {
        await app.documents('api::page.page').update({ documentId: existing.documentId, data: mapped.data, status: 'published' });
      } else {
        await app.documents('api::page.page').create({ data: mapped.data, status: 'published' });
      }
      stats.imported += 1;
    } catch (e) {
      stats.errors += 1;
      console.error(`[import] page ${post.id} (${mapped.path}) failed: ${e.message}`);
    }
  }
  console.log('[import] pages done', JSON.stringify(stats));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
