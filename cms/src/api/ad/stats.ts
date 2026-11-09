import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import { ZONES, marketOf, type MarketField } from './zones';

// Ad reporting. Each viewable impression and click is added to a daily row
// per ad × country × placement (table hl_ad_daily; the ad's own lifetime
// impressions/clicks counters carry on as before). The "Performance" panel on
// an ad, and its CSV download, read from here.
//
// Days are New Zealand days, like the rest of the site. Search-engine and
// link-preview bots aren't counted, nor are "?geo=" previews (the site doesn't
// send a beacon for those).

const TABLE = 'hl_ad_daily';
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|monitor/i;
const SITE_TZ = 'Pacific/Auckland';

export const MARKET_NAMES: Record<MarketField, string> = {
  showAustralia: 'Australia',
  showNewZealand: 'New Zealand',
  showUSA: 'USA',
  showCanada: 'Canada',
  showUKIreland: 'UK & Ireland',
  showEurope: 'Europe',
  showElsewhere: 'Elsewhere',
};

// Additive; safe to run on every start.
export async function ensureAdStats(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  if (await db.schema.hasTable(TABLE)) return;
  await db.schema.createTable(TABLE, (t) => {
    t.string('ad_document_id', 64).notNullable();
    t.date('day').notNullable();
    t.string('country', 2).notNullable().defaultTo('XX');
    t.string('zone', 40).notNullable().defaultTo('');
    t.integer('impressions').notNullable().defaultTo(0);
    t.integer('clicks').notNullable().defaultTo(0);
    t.primary(['ad_document_id', 'day', 'country', 'zone']);
    t.index(['day']);
  });
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TZ }).format(new Date());

// Country: Cloudflare's header when the site is behind it, else what the
// page passed along (?c=), else unknown.
function countryOf(ctx: Context) {
  const cf = String(ctx.get('cf-ipcountry') || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(cf) && cf !== 'XX' && cf !== 'T1') return cf;
  const c = String(ctx.query.c || '').toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : 'XX';
}

export const isBot = (ctx: Context) => BOTS.test(String(ctx.get('user-agent') || ''));

export async function recordAdEvent(strapi: Core.Strapi, ctx: Context, documentId: string, kind: 'impressions' | 'clicks') {
  if (isBot(ctx)) return;
  if (!/^[a-z0-9]{10,64}$/i.test(documentId)) return;
  const zone = String(ctx.query.z || '');
  const row = {
    ad_document_id: documentId,
    day: today(),
    country: countryOf(ctx),
    zone: zone in ZONES ? zone : '',
    impressions: kind === 'impressions' ? 1 : 0,
    clicks: kind === 'clicks' ? 1 : 0,
  };
  const db = strapi.db.connection;
  await db(TABLE)
    .insert(row)
    .onConflict(['ad_document_id', 'day', 'country', 'zone'])
    .merge({ [kind]: db.raw(`${TABLE}.${kind} + 1`) });
}

type Range = { from: string; to: string };

export async function adReport(strapi: Core.Strapi, documentId: string, range: Range) {
  const db = strapi.db.connection;
  const base = () => db(TABLE).where('ad_document_id', documentId).whereBetween('day', [range.from, range.to]);
  const sum = (q: any) => q.sum({ impressions: 'impressions', clicks: 'clicks' });
  const [totals] = await sum(base());
  const byDay = await sum(base().select('day').groupBy('day').orderBy('day'));
  const byCountry = await sum(base().select('country').groupBy('country'));
  const byZone = await sum(base().select('zone').groupBy('zone'));

  const num = (v: unknown) => Number(v || 0);
  const ctr = (i: number, c: number) => (i ? Math.round((c / i) * 10000) / 100 : null);
  const markets = new Map<string, { impressions: number; clicks: number }>();
  for (const r of byCountry as any[]) {
    const name = r.country === 'XX' ? 'Unknown' : MARKET_NAMES[marketOf(r.country)];
    const m = markets.get(name) || { impressions: 0, clicks: 0 };
    m.impressions += num(r.impressions);
    m.clicks += num(r.clicks);
    markets.set(name, m);
  }
  const t = { impressions: num(totals?.impressions), clicks: num(totals?.clicks) };
  return {
    range,
    totals: { ...t, ctr: ctr(t.impressions, t.clicks) },
    byDay: (byDay as any[]).map((r) => ({
      day: typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
    })),
    byMarket: [...markets.entries()]
      .map(([market, m]) => ({ market, ...m, ctr: ctr(m.impressions, m.clicks) }))
      .sort((a, b) => b.impressions - a.impressions),
    byCountry: (byCountry as any[])
      .map((r) => ({ country: r.country, impressions: num(r.impressions), clicks: num(r.clicks) }))
      .sort((a, b) => b.impressions - a.impressions),
    byZone: (byZone as any[])
      .map((r) => ({
        zone: r.zone,
        label: (ZONES as Record<string, { label: string }>)[r.zone]?.label || (r.zone ? r.zone : 'Not recorded'),
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        ctr: ctr(num(r.impressions), num(r.clicks)),
      }))
      .sort((a, b) => b.impressions - a.impressions),
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function registerAdReportRoutes(strapi: Core.Strapi) {
  const UID = 'api::ad.ad';
  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        method: 'GET',
        path: '/hl-ads/:documentId/report',
        config: { policies: ['admin::isAuthenticatedAdmin'] },
        handler: async (ctx: any) => {
          const checker = strapi
            .plugin('content-manager')
            .service('permission-checker')
            .create({ userAbility: ctx.state.userAbility, model: UID });
          if (checker.cannot.read()) return ctx.forbidden();
          const ad: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId, fields: ['name', 'impressions', 'clicks', 'createdAt'] as any });
          if (!ad) return ctx.notFound();
          const to = ISO.test(String(ctx.query.to)) ? String(ctx.query.to) : today();
          const from = ISO.test(String(ctx.query.from)) ? String(ctx.query.from) : '2000-01-01';
          ctx.body = {
            ad: { name: ad.name, lifetimeImpressions: ad.impressions || 0, lifetimeClicks: ad.clicks || 0 },
            ...(await adReport(strapi, ctx.params.documentId, { from, to })),
          };
        },
      },
    ],
  } as any);
}
