#!/usr/bin/env node
'use strict';

// Loads WordPress photo records (migration/export_photos.php output) into the
// photo archive table (src/photos.ts):
//
//   node scripts/import-photos.js photos.json [more.json …]   add / update
//   node scripts/import-photos.js --reconcile ids.json         drop photos deleted in WordPress
//   node scripts/import-photos.js --usage                      only refresh "used in" headlines
//
// Every run ends by refreshing which stories each photo appeared in (featured
// image, uploaded into, or in the body as wp-image-N), so the archive can be
// searched by headline. Safe to rerun.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const TABLE = 'hl_photos';
const tz = (s) => (s && !String(s).startsWith('0000') ? `${String(s).replace(' ', 'T')}Z` : null);

function row(p) {
  return {
    wp_id: p.id,
    url: p.url,
    thumb: p.thumb || null,
    title: p.title || '',
    alt: p.alt || '',
    caption: p.caption || '',
    description: String(p.description || '').slice(0, 4000),
    mime: p.mime ? String(p.mime).slice(0, 40) : null,
    width: p.width || null,
    height: p.height || null,
    uploaded_at: tz(p.date),
    modified_at: tz(p.modified),
    parent_wp_id: p.parent || null,
    on_disk: p.exists !== false,
    synced_at: new Date(),
  };
}

async function upsert(db, photos) {
  let n = 0;
  for (let i = 0; i < photos.length; i += 1000) {
    const batch = photos.slice(i, i + 1000).filter((p) => p && p.id && p.url).map(row);
    if (!batch.length) continue;
    await db(TABLE)
      .insert(batch)
      .onConflict('wp_id')
      .merge(['url', 'thumb', 'title', 'alt', 'caption', 'description', 'mime', 'width', 'height', 'uploaded_at', 'modified_at', 'parent_wp_id', 'on_disk', 'synced_at']);
    n += batch.length;
  }
  return n;
}

async function reconcile(db, ids) {
  const keep = new Set(ids.map(Number));
  const have = (await db(TABLE).count({ n: '*' }))[0].n;
  // Guard against a short or failed export wiping the archive.
  if (keep.size < Number(have) * 0.95) throw new Error(`refused: WordPress listed ${keep.size} photos, archive has ${have}`);
  const gone = (await db(TABLE).pluck('wp_id')).map(Number).filter((id) => !keep.has(id));
  if (gone.length > 2000) throw new Error(`refused: ${gone.length} photos would be removed`);
  for (let i = 0; i < gone.length; i += 1000) await db(TABLE).whereIn('wp_id', gone.slice(i, i + 1000)).del();
  return gone.length;
}

// Which published stories used each photo: as the featured image, as the post
// it was uploaded into, or in the body (WordPress marks inline images with a
// wp-image-<id> class). Keeps the five most recent headlines.
async function refreshUsage(db) {
  await db.raw(`
    WITH pub AS (
      SELECT id, title, publish_date, legacy_wp_id, body_html FROM articles WHERE published_at IS NOT NULL
    ), uses AS (
      SELECT l.legacy_wp_id AS wp_id, a.id AS article_id
        FROM components_shared_legacy_images l
        JOIN articles_cmps c ON c.cmp_id = l.id AND c.component_type = 'shared.legacy-image'
        JOIN pub a ON a.id = c.entity_id
       WHERE l.legacy_wp_id IS NOT NULL
      UNION
      SELECT p.wp_id, a.id FROM ${TABLE} p JOIN pub a ON a.legacy_wp_id = p.parent_wp_id
      UNION
      SELECT m[1]::bigint, a.id FROM pub a, regexp_matches(a.body_html, 'wp-image-([0-9]{1,9})', 'g') m
       WHERE a.body_html LIKE '%wp-image-%'
    ), ranked AS (
      SELECT u.wp_id, a.title, a.publish_date,
             row_number() OVER (PARTITION BY u.wp_id ORDER BY a.publish_date DESC NULLS LAST) AS rn,
             count(*) OVER (PARTITION BY u.wp_id) AS n
        FROM uses u JOIN pub a ON a.id = u.article_id
    ), agg AS (
      SELECT wp_id, string_agg(title, E'\\n' ORDER BY publish_date DESC NULLS LAST) FILTER (WHERE rn <= 5) AS stories,
             max(n)::int AS n, max(publish_date) AS last_used
        FROM ranked GROUP BY wp_id
    )
    UPDATE ${TABLE} p
       SET stories = coalesce(u.stories, ''), story_count = coalesce(u.n, 0), last_used_at = u.last_used
      FROM (SELECT p2.wp_id, agg.stories, agg.n, agg.last_used FROM ${TABLE} p2 LEFT JOIN agg ON agg.wp_id = p2.wp_id) u
     WHERE p.wp_id = u.wp_id
       AND (p.stories IS DISTINCT FROM coalesce(u.stories, '') OR p.story_count IS DISTINCT FROM coalesce(u.n, 0)
            OR p.last_used_at IS DISTINCT FROM u.last_used)
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  const db = app.db.connection;
  const t0 = Date.now();
  try {
    if (args[0] === '--reconcile') {
      const removed = await reconcile(db, JSON.parse(fs.readFileSync(args[1], 'utf8')));
      console.log(`[photos] reconcile done: ${removed} removed`);
    } else if (args[0] !== '--usage') {
      let n = 0;
      for (const f of args) n += await upsert(db, JSON.parse(fs.readFileSync(f, 'utf8')));
      console.log(`[photos] ${n} upserted`);
    }
    const t1 = Date.now();
    await refreshUsage(db);
    const [{ total, shown }] = (await db.raw(`SELECT count(*) AS total, count(*) FILTER (WHERE on_disk) AS shown FROM ${TABLE}`)).rows;
    console.log(`[photos] done: ${total} in archive, ${shown} searchable; usage refreshed in ${((Date.now() - t1) / 1000).toFixed(1)}s, total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(`[photos] failed: ${err.message}`);
  process.exit(1);
});
