#!/usr/bin/env node
'use strict';

// Loads migration/export_directory.php output into Strapi.
//   node scripts/import-directory.js directory.json
// Idempotent on legacyId (the WordPress row id that profile URLs use).

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const UID = 'api::directory-listing.directory-listing';
const blank = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v));
const int = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10) || 0);
const keyOf = (t) => (t || 'stallion').replace(/-/g, '_');

function mapListing(l) {
  const ped = {};
  for (const k of ['sire', 'dam', 'ss', 'sd', 'ds', 'dd', 'sss', 'ssd', 'sds', 'sdd', 'dss', 'dsd', 'dds', 'ddd']) {
    const v = blank(l[`ped_${k}`]);
    if (v) ped[k] = v;
  }
  const banner = blank(l.banner_url) || l.banner_image
    ? {
        imageUrl: l.banner_image ? l.banner_image.url : null,
        url: blank(l.banner_url),
        target: blank(l.banner_target),
        alt: blank(l.banner_alt),
        startsOn: blank(l.banner_start),
        endsOn: blank(l.banner_end),
      }
    : null;
  return {
    name: l.name,
    slug: l.slug,
    directoryType: keyOf(l.directory_type || l.type),
    legacyId: Number(l.id),
    isPaying: l.is_paying === '1' || l.is_paying === 1,
    isFeatured: l.is_featured === '1' || l.is_featured === 1,
    studName: blank(l.stud_name),
    studMaster: blank(l.stud_master),
    country: blank(l.country),
    region: blank(l.region),
    suburb: blank(l.suburb),
    industry: blank(l.industry),
    coverage: blank(l.coverage),
    statusNote: blank(l.status_note),
    tagline: blank(l.tagline),
    shortSummary: blank(l.short_summary),
    gait: /trot/i.test(l.type || '') ? 'Trotter' : 'Pacer',
    yearOfBirth: blank(l.year_of_birth),
    colour: blank(l.colour),
    sex: blank(l.sex),
    profileBio: blank(l.profile_bio),
    raceRecord: blank(l.race_record),
    careerEarnings: blank(l.career_earnings),
    serviceFee: blank(l.service_fee),
    progenyNote: blank(l.progeny_note),
    crossesIntro: blank(l.crosses_intro),
    bookingUrl: blank(l.booking_url),
    bookingLabel: blank(l.booking_label),
    profileImageUrl: blank(l.profile_image),
    heroImageUrl: l.hero_image ? l.hero_image.url : null,
    contact: {
      phone: blank(l.contact_phone), email: blank(l.contact_email), website: blank(l.contact_website),
      studWebsite: blank(l.stud_website), address: blank(l.contact_address),
      contactAu: blank(l.contact_au), contactNz: blank(l.contact_nz), contactUs: blank(l.contact_us),
      contactFr: blank(l.contact_fr), contactOther: blank(l.contact_other),
    },
    pedigree: Object.keys(ped).length ? ped : null,
    progeny: (l.progeny || []).map((p) => ({
      name: p.name, foalingDate: blank(p.foaling_date), country: blank(p.country), sex: blank(p.sex),
      dam: blank(p.dam), broodmareSire: blank(p.broodmare_sire), prizemoney: blank(p.prizemoney),
      prizemoneyNum: p.prizemoney_num ? String(p.prizemoney_num) : null, mileRate: blank(p.mile_rate),
      starts: int(p.starts), wins: int(p.wins),
    })),
    gallery: (l.gallery || []).filter((g) => g.url).map((g) => ({
      mediaType: g.media_type === 'video' ? 'video' : 'image', url: g.url,
      caption: blank(g.caption), description: blank(g.description),
    })),
    crosses: (l.crosses || []).map((c) => ({ title: c.title, description: blank(c.description), examples: blank(c.examples) })),
    banner,
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node scripts/import-directory.js directory.json');
  const { listings, enquiries } = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const appDir = process.cwd();
  const distDir = path.join(appDir, 'dist');
  const prebuilt = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'src'));
  const app = await createStrapi(prebuilt ? { appDir, distDir } : await compileStrapi()).load();
  app.log.level = 'warn';
  const stats = { listings: 0, errors: 0, related: 0, enquiries: 0 };
  const docIds = new Map(); // legacyId -> documentId
  try {
    for (const l of listings) {
      try {
        const data = mapListing(l);
        const ex = await app.documents(UID).findFirst({ filters: { legacyId: data.legacyId }, fields: ['documentId'] });
        const doc = ex
          ? await app.documents(UID).update({ documentId: ex.documentId, data })
          : await app.documents(UID).create({ data });
        docIds.set(Number(l.id), doc.documentId);
        stats.listings += 1;
      } catch (e) {
        stats.errors += 1;
        console.error(`[directory] listing ${l.id} (${l.name}) failed: ${e.message}`);
      }
    }
    // Second pass: related horses, now every listing has a documentId.
    for (const l of listings) {
      let ids = [];
      try { ids = JSON.parse(l.related_ids || '[]'); } catch { ids = String(l.related_ids || '').split(',').map((s) => s.trim()); }
      const related = ids.map((i) => docIds.get(Number(i))).filter(Boolean);
      if (related.length && docIds.get(Number(l.id))) {
        await app.documents(UID).update({ documentId: docIds.get(Number(l.id)), data: { related } });
        stats.related += 1;
      }
    }
    for (const q of enquiries || []) {
      const ex = await app.documents('api::directory-enquiry.directory-enquiry').findFirst({ filters: { legacyId: Number(q.id) } });
      if (ex) continue;
      await app.documents('api::directory-enquiry.directory-enquiry').create({
        data: {
          legacyId: Number(q.id), listingType: blank(q.listing_type), contactName: blank(q.contact_name),
          contactEmail: blank(q.contact_email), contactPhone: blank(q.contact_phone), studName: blank(q.stud_name),
          country: blank(q.country), region: blank(q.region), message: blank(q.message),
          status: ['new', 'contacted', 'closed'].includes(q.status) ? q.status : 'new',
          adminNotes: blank(q.admin_notes), submittedAt: q.submitted_at ? `${q.submitted_at.replace(' ', 'T')}Z` : null,
        },
      });
      stats.enquiries += 1;
    }
  } finally {
    console.log('[directory] done', JSON.stringify(stats));
    await app.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
