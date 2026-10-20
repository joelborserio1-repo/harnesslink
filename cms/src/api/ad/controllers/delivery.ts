import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import { ZONES, marketOf, showsIn, weightedSample, type Zone } from '../zones';

const UID = 'api::ad.ad';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  // GET /api/ads/live?country=AU — { ads: { zone: [creative, …] } } for every
  // booked zone, keeping only ads that run in the reader's country.
  async live(ctx: Context) {
    const market = marketOf(String(ctx.query.country || ''));
    const now = new Date().toISOString();
    const ads = await strapi.documents(UID).findMany({
      filters: {
        active: true,
        $and: [
          { $or: [{ startsAt: { $null: true } }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: { $null: true } }, { endsAt: { $gte: now } }] },
        ],
      },
      populate: { image: { fields: ['url', 'width', 'height', 'alternativeText'] } },
      limit: 500,
    });

    type AdDoc = (typeof ads)[number] & { weight?: number | null };
    const byZone: Record<string, AdDoc[]> = {};
    for (const ad of ads as AdDoc[]) if (ad.zone && showsIn(ad as never, market)) (byZone[ad.zone] ||= []).push(ad);

    const out: Record<string, unknown[]> = {};
    for (const [zone, list] of Object.entries(byZone)) {
      const slots = ZONES[zone as Zone]?.slots ?? 1;
      out[zone] = weightedSample(list, slots).map((ad) => {
        const image = ad.image as { url?: string; width?: number; height?: number } | null;
        return {
          id: ad.documentId,
          zone: ad.zone,
          image_url: image?.url ?? ad.imageUrl ?? null,
          width: ad.imageWidth ?? image?.width ?? null,
          height: ad.imageHeight ?? image?.height ?? null,
          html: ad.html || null,
          alt: ad.alt || ad.name,
          click_url: `/ad/${ad.documentId}/click/`,
        };
      });
    }

    ctx.set('Cache-Control', 'no-store');
    ctx.body = { ads: out };
  },

  // GET /api/ads/:documentId/click — count the click, then go to the advertiser.
  async click(ctx: Context) {
    const { documentId } = ctx.params;
    const ad = await strapi.documents(UID).findOne({ documentId, fields: ['linkUrl'] });
    if (ad) await strapi.db.connection('ads').where({ document_id: documentId }).increment('clicks', 1);
    ctx.status = 302;
    ctx.redirect(ad?.linkUrl || '/');
  },

  // POST /api/ads/:documentId/impression — one viewable impression.
  async impression(ctx: Context) {
    await strapi.db.connection('ads').where({ document_id: ctx.params.documentId }).increment('impressions', 1);
    ctx.status = 204;
  },
});
