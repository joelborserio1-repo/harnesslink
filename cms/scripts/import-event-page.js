#!/usr/bin/env node
'use strict';

// Creates an Event page (e.g. The Eureka) from a seed folder:
//
//   node scripts/import-event-page.js /tmp/eureka-seed            (data.json + images/)
//   node scripts/import-event-page.js /tmp/eureka-seed --update   (overwrite an existing page)
//
// data.json holds the page fields; image fields name files in images/, which
// are added to the Media Library (reused by file name if already there). The
// Eureka seed was exported read-only from the live WordPress page.
// Without --update an existing page with the same slug is left alone.

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const UID = 'api::event-page.event-page';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

async function main() {
  const dir = process.argv[2];
  const update = process.argv.includes('--update');
  if (!dir) throw new Error('usage: node scripts/import-event-page.js <seed-folder> [--update]');
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));

  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  app.log.level = 'warn';

  try {
    const existing = await app.documents(UID).findFirst({ filters: { slug: data.slug }, fields: ['documentId'] });
    if (existing && !update) {
      console.log(`[event-page] /${data.slug}/ already exists; pass --update to overwrite it`);
      return;
    }

    const cache = new Map();
    const image = async (file, alt) => {
      if (!file) return null;
      if (cache.has(file)) return cache.get(file);
      const found = await app.db.query('plugin::upload.file').findOne({ where: { name: file } });
      let id = found?.id;
      if (!id) {
        const filepath = path.join(dir, 'images', file);
        const [uploaded] = await app.plugin('upload').service('upload').upload({
          data: { fileInfo: { name: file, alternativeText: alt || (data.alts || {})[file] || '' } },
          files: { filepath, originalFilename: file, mimetype: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', size: fs.statSync(filepath).size },
        });
        id = uploaded.id;
      }
      cache.set(file, id);
      return id;
    };

    const category = data.newsCategorySlug
      ? await app.documents('api::category.category').findFirst({ filters: { slug: data.newsCategorySlug }, fields: ['documentId'] })
      : null;

    const page = {
      title: data.title,
      slug: data.slug,
      subtitle: data.subtitle,
      eventStart: data.eventStart,
      timezone: data.timezone,
      countdownFinishedText: data.countdownFinishedText,
      venue: data.venue,
      location: data.location,
      prizeMoney: data.prizeMoney,
      distance: data.distance,
      slots: data.slots,
      eligibility: data.eligibility,
      organiserLabel: data.organiserLabel,
      showNews: true,
      newsCategory: category ? category.documentId : null,
      newsCount: data.newsCount,
      showOdds: true,
      oddsTitle: data.oddsTitle,
      tabRaceName: data.tabRaceName,
      tabMarketUrl: data.tabMarketUrl,
      oddsRunnersShown: data.oddsRunnersShown,
      backupPrices: data.backupPrices,
      backupPricesAt: data.backupPricesAt,
      showSocial: true,
      socialTitle: data.socialTitle,
      curatorFeedId: data.curatorFeedId,
      xHandle: data.xHandle,
      hashtags: data.hashtags,
      showResults: true,
      resultsSponsorLabel: data.resultsSponsorLabel,
      showAbout: true,
      aboutHeading: data.aboutHeading,
      aboutSubheading: data.aboutSubheading,
      aboutHtml: data.aboutHtml,
      showSlotHolders: true,
      slotHoldersHeading: data.slotHoldersHeading,
      slotHoldersNote: data.slotHoldersNote,
      showAssociates: true,
      associatesHeading: data.associatesHeading,
      seo: data.seo,
    };
    for (const [field, file] of Object.entries(data.images || {})) page[field] = await image(file);
    page.results = [];
    for (const r of data.results || []) {
      page.results.push({ ...r, winnerSilks: await image(r.winnerSilks, `${r.winner} silks`), winnerPhoto: await image(r.winnerPhoto, r.winner) });
    }
    page.slotHolders = [];
    for (const s of data.slotHolders || []) page.slotHolders.push({ ...s, silks: await image(s.silks, `${s.name} silks`) });
    page.associates = [];
    for (const a of data.associates || []) page.associates.push({ ...a, logo: await image(a.logo, a.name) });

    if (existing) {
      await app.documents(UID).update({ documentId: existing.documentId, data: page, status: 'published' });
      console.log(`[event-page] updated /${data.slug}/`);
    } else {
      await app.documents(UID).create({ data: page, status: 'published' });
      console.log(`[event-page] created /${data.slug}/ (${cache.size} images)`);
    }
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
