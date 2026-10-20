import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import { DIRECTORY_TYPES, byKey, byUrl } from '../types';

const UID = 'api::directory-listing.directory-listing';

type Media = { url?: string } | null | undefined;
type Listing = Record<string, any>;

const blank = (v: unknown) => (v === undefined || v === null || v === '' ? null : v);

// The id used in public URLs: the WordPress row id when migrated, else Strapi's.
const publicId = (l: Listing) => (l.legacyId ? Number(l.legacyId) : l.id);
const pathOf = (l: Listing) => `/directory/${byKey(l.directoryType)?.url ?? 'listings'}/${publicId(l)}/${l.slug}/`;
const image = (l: Listing) => (l.profileImage as Media)?.url ?? blank(l.profileImageUrl);

function summary(l: Listing) {
  const t = byKey(l.directoryType);
  return {
    id: publicId(l),
    slug: l.slug,
    name: l.name,
    directory_type: l.directoryType,
    type_label: t?.singular ?? null,
    org_label: t?.org_label ?? null,
    stud_name: blank(l.studName),
    country: blank(l.country),
    region: blank(l.region),
    gait: t?.supports_gait ? l.gait : null,
    is_paying: !!l.isPaying,
    is_featured: !!l.isFeatured,
    profile_image: image(l),
    path: pathOf(l),
  };
}

function full(l: Listing) {
  const data: Record<string, unknown> = {
    ...summary(l),
    stud_master: blank(l.studMaster),
    suburb: blank(l.suburb),
    industry: blank(l.industry),
    coverage: blank(l.coverage),
    status_note: blank(l.statusNote),
    profile_bio: blank(l.profileBio),
    race_record: blank(l.raceRecord),
    service_fee: blank(l.serviceFee),
    progeny_note: blank(l.progenyNote),
    tagline: blank(l.tagline),
    short_summary: blank(l.shortSummary),
    year_of_birth: blank(l.yearOfBirth),
    colour: blank(l.colour),
    sex: blank(l.sex),
    career_earnings: blank(l.careerEarnings),
    hero_image: blank(l.heroImageUrl),
    booking: l.bookingUrl ? { url: l.bookingUrl, label: l.bookingLabel || 'Book a service' } : null,
    pedigree: l.pedigree ?? null,
    crosses_intro: blank(l.crossesIntro),
    crosses: (l.crosses || []).map((c: Listing) => ({ title: c.title, description: blank(c.description), examples: blank(c.examples) })),
    gallery: (l.gallery || []).map((g: Listing) => ({
      media_type: g.mediaType,
      url: (g.image as Media)?.url ?? g.url,
      caption: blank(g.caption),
      description: blank(g.description),
    })),
    related: (l.related || []).map(summary),
    progeny: (l.progeny || []).map((p: Listing) => ({
      name: p.name,
      foaling_date: blank(p.foalingDate),
      country: blank(p.country),
      sex: blank(p.sex),
      dam: blank(p.dam),
      broodmare_sire: blank(p.broodmareSire),
      prizemoney: blank(p.prizemoney),
      mile_rate: blank(p.mileRate),
      starts: p.starts ?? 0,
      wins: p.wins ?? 0,
    })),
  };
  // Contact details are a paid-tier feature.
  if (l.isPaying && l.contact) {
    const c = l.contact;
    data.contact = Object.fromEntries(
      Object.entries({
        phone: c.phone, email: c.email, website: c.website, stud_website: c.studWebsite, address: c.address,
        au: c.contactAu, nz: c.contactNz, us: c.contactUs, fr: c.contactFr, other: c.contactOther,
      }).filter(([, v]) => blank(v) !== null)
    );
  }
  return data;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  // GET /api/directory — the types with listing counts.
  async hub(ctx: Context) {
    const rows = await strapi.db.connection('directory_listings').select('directory_type').count({ n: '*' }).groupBy('directory_type');
    const counts: Record<string, number> = Object.fromEntries(rows.map((r: any) => [r.directory_type, Number(r.n)]));
    ctx.body = {
      types: DIRECTORY_TYPES.map((t) => ({ key: t.key, url: t.url, singular: t.singular, plural: t.plural, org_label: t.org_label, count: counts[t.key] || 0 })),
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  },

  // GET /api/directory/:type?country= — listings of one type, featured first.
  async type(ctx: Context) {
    const t = byUrl(ctx.params.type);
    if (!t) return ctx.notFound();
    const country = ctx.query.country ? String(ctx.query.country) : '';
    const listings = await strapi.documents(UID).findMany({
      filters: { directoryType: t.key, ...(country ? { country } : {}) },
      sort: ['isFeatured:desc', 'name:asc'],
      populate: { profileImage: { fields: ['url'] } },
      limit: 1000,
    });
    const countryRows = await strapi.db
      .connection('directory_listings')
      .where({ directory_type: t.key })
      .whereNotNull('country')
      .whereNot('country', '')
      .distinct('country')
      .orderBy('country');
    ctx.body = {
      type: { key: t.key, url: t.url, singular: t.singular, plural: t.plural, org_label: t.org_label, supports_gait: t.supports_gait },
      countries: countryRows.map((r: any) => r.country),
      listings: listings.map(summary),
    };
  },

  // GET /api/directory/:type/:id — one profile, by public id.
  async show(ctx: Context) {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) return ctx.notFound();
    const populate = {
      profileImage: { fields: ['url'] },
      contact: true,
      pedigree: true,
      progeny: true,
      crosses: true,
      gallery: { populate: { image: { fields: ['url'] } } },
      related: { populate: { profileImage: { fields: ['url'] } } },
    } as any;
    const listing =
      (await strapi.documents(UID).findFirst({ filters: { legacyId: id }, populate })) ||
      (await strapi.documents(UID).findFirst({ filters: { id, legacyId: { $null: true } }, populate }));
    if (!listing) return ctx.notFound();
    ctx.body = { listing: full(listing as Listing) };
  },

  // POST /api/directory-enquiries/submit — "list my business" form.
  async enquire(ctx: Context) {
    const b = (ctx.request.body || {}) as Record<string, unknown>;
    const s = (k: string, max = 255) => String(b[k] ?? '').trim().slice(0, max);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s('email')) || !s('name')) {
      ctx.status = 422;
      ctx.body = { error: 'Please give your name and a valid email address.' };
      return;
    }
    await strapi.documents('api::directory-enquiry.directory-enquiry').create({
      data: {
        contactName: s('name'), contactEmail: s('email'), contactPhone: s('phone'), listingType: s('listing_type', 60),
        studName: s('stud_name'), country: s('country', 80), region: s('region', 80), message: s('message', 5000),
        status: 'new', submittedAt: new Date().toISOString(),
      },
    });
    ctx.status = 201;
    ctx.body = { ok: true };
  },
});
