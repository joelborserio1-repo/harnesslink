import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import { createHash, randomBytes } from 'node:crypto';
import { isBot } from './api/ad/stats';

// Story reads, by where the reader came from.
//
// The story page sends one beacon when it opens in a real browser
// (web/src/components/article/ViewBeacon.tsx), including inside the Facebook,
// Instagram and X in-app browsers. Each beacon is added to a daily row per
// story × source × country in hl_story_reads:
//   views   every opening of the story (reloads included)
//   readers one per person per story per day (see below)
// The story's lifetime articles.view_count carries on as before.
//
// Source, in order of trust:
//   1. utm_source on the link (Postiz and our newsletters tag their links)
//   2. the in-app browser's signature in the user agent (FBAN/FBAV, Instagram…)
//   3. the page the reader came from (l.facebook.com, t.co, google…)
//
// Readers are counted without cookies or stored personal data: the browser
// remembers which stories it has counted today (localStorage), and the CMS
// keeps a one-way hash of address + browser + story, salted with a random
// value that changes every day and is never stored, so it can't be reversed
// or linked across days. Both reset at midnight NZ time.
//
// Days are New Zealand days, like the rest of the site.

const TABLE = 'hl_story_reads';
export const SITE_TZ = 'Pacific/Auckland';

export const SOURCES = ['facebook', 'instagram', 'x', 'threads', 'google', 'search', 'newsletter', 'internal', 'direct', 'other'] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_NAMES: Record<Source, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  threads: 'Threads',
  google: 'Google',
  search: 'Other search',
  newsletter: 'Newsletter / email',
  internal: 'From our site',
  direct: 'Direct',
  other: 'Other sites',
};

export async function ensureStoryStats(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  if (await db.schema.hasTable(TABLE)) return;
  await db.schema.createTable(TABLE, (t) => {
    t.string('document_id', 64).notNullable();
    t.date('day').notNullable();
    t.string('source', 16).notNullable();
    t.string('country', 2).notNullable().defaultTo('XX');
    t.integer('views').notNullable().defaultTo(0);
    t.integer('readers').notNullable().defaultTo(0);
    t.primary(['document_id', 'day', 'source', 'country']);
    t.index(['day']);
  });
}

export const isoDay = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TZ }).format(d);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// ---- Where did the reader come from? ----

const UTM: [RegExp, Source][] = [
  [/^(fb|facebook|meta)/, 'facebook'],
  [/^(ig|insta)/, 'instagram'],
  [/^(x|twitter|tw|x\.com)$/, 'x'],
  [/^threads/, 'threads'],
  [/^google/, 'google'],
  [/(newsletter|mailchimp|email|insider|brevo|edm)/, 'newsletter'],
];
const IN_APP: [RegExp, Source][] = [
  [/Instagram/, 'instagram'], // before Facebook: Instagram's browser also says FBAN on some builds
  [/Barcelona/, 'threads'], // the Threads app
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBMD|\[FB/, 'facebook'],
  [/Twitter|TwitterAndroid/, 'x'],
];
const REFERRER: [RegExp, Source][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(threads\.net|threads\.com)$/, 'threads'],
  [/(^|\.)google\.[a-z.]+$|googlequicksearchbox|^news\.google/, 'google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|search\.brave\.com|yandex\.[a-z]+|baidu\.com)$/, 'search'],
  [/(list-manage\.com|mailchimp|mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com|brevo|sendinblue)/, 'newsletter'],
];

function hostOf(url: string) {
  // Android apps send android-app://com.google.android.googlequicksearchbox/
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function classify(input: { utm?: string; ua?: string; referrer?: string; siteHost?: string }): Source {
  const utm = String(input.utm || '').toLowerCase().trim();
  if (utm) {
    for (const [re, s] of UTM) if (re.test(utm)) return s;
  }
  const ua = String(input.ua || '');
  for (const [re, s] of IN_APP) if (re.test(ua)) return s;
  const ref = String(input.referrer || '');
  const host = hostOf(ref) || (ref.startsWith('android-app://') ? ref.slice(14).split('/')[0] : '');
  if (!host) return utm ? 'other' : 'direct';
  const site = (input.siteHost || '').toLowerCase().replace(/^www\./, '');
  if (site && (host === site || host.endsWith(`.${site}`) || host.endsWith('harnesslink.com'))) return 'internal';
  for (const [re, s] of REFERRER) if (re.test(host)) return s;
  return 'other';
}

// ---- Recording ----

function countryOf(ctx: Context) {
  const cf = String(ctx.get('cf-ipcountry') || '').toUpperCase();
  return /^[A-Z]{2}$/.test(cf) && cf !== 'XX' && cf !== 'T1' ? cf : 'XX';
}
function addressOf(ctx: Context) {
  return String(ctx.get('cf-connecting-ip') || String(ctx.get('x-forwarded-for') || '').split(',')[0] || ctx.ip || '').trim();
}

// Today's salt and the readers already counted today. Memory only.
let saltDay = '';
let salt = randomBytes(32);
let seen = new Set<string>();
const SEEN_MAX = 300_000;

function firstTodayForServer(day: string, key: string) {
  if (day !== saltDay) {
    saltDay = day;
    salt = randomBytes(32);
    seen = new Set();
  }
  const h = createHash('sha256').update(salt).update(key).digest('base64').slice(0, 16);
  if (seen.has(h)) return false;
  if (seen.size < SEEN_MAX) seen.add(h);
  return true;
}

// slug → documentId of the published story; small cache, refreshed hourly.
const docCache = new Map<string, { id: string | null; at: number }>();
async function documentIdOf(strapi: Core.Strapi, slug: string) {
  const hit = docCache.get(slug);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.id;
  const row = await strapi.db.connection('articles').where({ slug }).whereNotNull('published_at').first('document_id');
  const id = row?.document_id ?? null;
  if (docCache.size > 20_000) docCache.clear();
  docCache.set(slug, { id, at: Date.now() });
  return id;
}

export async function recordRead(strapi: Core.Strapi, ctx: Context, slug: string) {
  if (isBot(ctx)) return;
  if (!/^[a-z0-9-]{1,200}$/i.test(slug)) return;
  const documentId = await documentIdOf(strapi, slug);
  if (!documentId) return;
  const body = (ctx.request as any).body || {};
  const ua = String(ctx.get('user-agent') || '');
  const source = classify({
    utm: String(body.u || '').slice(0, 60),
    ua,
    referrer: String(body.r || '').slice(0, 500),
    siteHost: String(ctx.get('x-forwarded-host') || ctx.get('host') || '').split(':')[0],
  });
  const day = isoDay();
  // A reader is new unless this browser says it already counted the story
  // today (f=0) or we've seen this address + browser + story today.
  const browserSaysFirst = body.f !== 0 && body.f !== '0';
  const reader = firstTodayForServer(day, `${addressOf(ctx)}|${ua}|${documentId}`) && browserSaysFirst ? 1 : 0;
  const db = strapi.db.connection;
  await db(TABLE)
    .insert({ document_id: documentId, day, source, country: countryOf(ctx), views: 1, readers: reader })
    .onConflict(['document_id', 'day', 'source', 'country'])
    .merge({ views: db.raw(`${TABLE}.views + 1`), readers: db.raw(`${TABLE}.readers + ?`, [reader]) });
}

// ---- Reports ----

type Range = { from: string; to: string };
const num = (v: unknown) => Number(v) || 0;
const bySource = (rows: any[]) => {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.source] = (out[r.source] || 0) + num(r.readers);
  return out;
};

export async function overview(strapi: Core.Strapi, range: Range, limit = 25) {
  const db = strapi.db.connection;
  const inRange = () => db(TABLE).whereBetween('day', [range.from, range.to]);
  const [totals, sources, days, countries, top] = await Promise.all([
    inRange().sum({ views: 'views', readers: 'readers' }).first(),
    inRange().select('source').sum({ views: 'views', readers: 'readers' }).groupBy('source'),
    inRange().select(db.raw(`to_char(day, 'YYYY-MM-DD') as day`), 'source').sum({ readers: 'readers' }).groupBy('day', 'source').orderBy('day'),
    inRange().select('country').sum({ readers: 'readers' }).groupBy('country').orderBy('readers', 'desc').limit(8),
    inRange().select('document_id').sum({ readers: 'readers', views: 'views' }).groupBy('document_id').orderBy('readers', 'desc').limit(limit),
  ]);
  const ids = top.map((t: any) => t.document_id);
  const [stories, split] = await Promise.all([
    storiesById(strapi, ids),
    ids.length ? inRange().whereIn('document_id', ids).select('document_id', 'source').sum({ readers: 'readers' }).groupBy('document_id', 'source') : [],
  ]);
  const dayMap = new Map<string, Record<string, number>>();
  for (const r of days as any[]) {
    const d = dayMap.get(r.day) || {};
    d[r.source] = num(r.readers);
    dayMap.set(r.day, d);
  }
  return {
    range,
    totals: { views: num(totals?.views), readers: num(totals?.readers) },
    bySource: (sources as any[])
      .map((s) => ({ source: s.source, name: SOURCE_NAMES[s.source as Source] || s.source, views: num(s.views), readers: num(s.readers) }))
      .sort((a, b) => b.readers - a.readers),
    byDay: [...dayMap.entries()].map(([day, s]) => ({ day, total: Object.values(s).reduce((a, b) => a + b, 0), sources: s })),
    byCountry: (countries as any[]).map((c) => ({ country: c.country, readers: num(c.readers) })),
    top: top.map((t: any) => ({
      ...(stories.get(t.document_id) || { documentId: t.document_id, title: '(deleted story)' }),
      readers: num(t.readers),
      views: num(t.views),
      sources: bySource((split as any[]).filter((s) => s.document_id === t.document_id)),
    })),
  };
}

async function storiesById(strapi: Core.Strapi, ids: string[]) {
  const out = new Map<string, any>();
  if (!ids.length) return out;
  const rows = await strapi.db
    .connection('articles as a')
    .leftJoin('articles_primary_category_lnk as l', 'l.article_id', 'a.id')
    .leftJoin('categories as c', 'c.id', 'l.category_id')
    .whereIn('a.document_id', ids)
    .whereNotNull('a.published_at')
    .select('a.document_id', 'a.title', 'a.slug', 'a.publish_date', 'c.name as category');
  for (const r of rows) {
    out.set(r.document_id, { documentId: r.document_id, title: r.title, slug: r.slug, publishDate: r.publish_date, category: r.category || null });
  }
  return out;
}

// How each story published in the range did in its first two days (the day
// it went up and the next), against the median for its section over the
// previous 60 days. Index 1.0 = a normal story for that section; 2.0 = twice
// as many readers; 0.5 = half. A Canada result is only compared with other
// Canada stories, not with a Group 1 preview.
export async function performance(strapi: Core.Strapi, range: Range) {
  const db = strapi.db.connection;
  const yesterday = addDays(isoDay(), -1);
  const baselineFrom = addDays(range.from, -60);
  const rows = await db
    .select(
      'a.document_id',
      'a.title',
      'a.slug',
      'a.publish_date',
      'c.name as category',
      db.raw(`(a.publish_date at time zone ?)::date as pub_day`, [SITE_TZ]),
      db.raw(
        `coalesce((select sum(r.readers) from ${TABLE} r where r.document_id = a.document_id
           and r.day between (a.publish_date at time zone ?)::date and (a.publish_date at time zone ?)::date + 1), 0) as first2`,
        [SITE_TZ, SITE_TZ]
      ),
      db.raw(`coalesce((select sum(r.readers) from ${TABLE} r where r.document_id = a.document_id), 0) as total`)
    )
    .from('articles as a')
    .leftJoin('articles_primary_category_lnk as l', 'l.article_id', 'a.id')
    .leftJoin('categories as c', 'c.id', 'l.category_id')
    .whereNotNull('a.published_at')
    .whereRaw(`(a.publish_date at time zone ?)::date between ? and ?`, [SITE_TZ, baselineFrom, range.to])
    // Only stories with two full days behind them, and only since reads were recorded.
    .whereRaw(`(a.publish_date at time zone ?)::date <= ?::date - 1`, [SITE_TZ, yesterday])
    .whereRaw(`(a.publish_date at time zone ?)::date >= (select coalesce(min(day), current_date) from ${TABLE})`, [SITE_TZ]);

  const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const day = (r: any) => (r.pub_day instanceof Date ? r.pub_day.toISOString().slice(0, 10) : String(r.pub_day).slice(0, 10));
  const all = rows.map((r: any) => ({ ...r, day: day(r), first2: num(r.first2), total: num(r.total) }));
  const overall = median(all.map((r) => r.first2));
  const byCat = new Map<string, number[]>();
  for (const r of all) {
    const k = r.category || '—';
    byCat.set(k, [...(byCat.get(k) || []), r.first2]);
  }
  const baseline = new Map([...byCat].map(([k, xs]) => [k, xs.length >= 5 ? median(xs) : overall]));

  const stories = all
    .filter((r) => r.day >= range.from && r.day <= range.to)
    .map((r) => {
      const base = baseline.get(r.category || '—') || overall;
      return {
        documentId: r.document_id,
        title: r.title,
        slug: r.slug,
        publishDate: r.publish_date,
        category: r.category || null,
        firstTwoDays: r.first2,
        total: r.total,
        sectionMedian: Math.round(base),
        index: base > 0 ? Math.round((r.first2 / base) * 100) / 100 : null,
      };
    });
  const ranked = stories.filter((s) => s.index !== null).sort((a, b) => (b.index as number) - (a.index as number));
  return {
    range,
    count: stories.length,
    overallMedian: Math.round(overall),
    sections: [...baseline].map(([category, m]) => ({ category, median: Math.round(m), stories: byCat.get(category)?.length || 0 })),
    best: ranked.slice(0, 15),
    worst: ranked.slice(-15).reverse(),
  };
}

export async function storyReport(strapi: Core.Strapi, documentId: string) {
  const db = strapi.db.connection;
  const rows = await db(TABLE)
    .where('document_id', documentId)
    .select(db.raw(`to_char(day, 'YYYY-MM-DD') as day`), 'source')
    .sum({ readers: 'readers', views: 'views' })
    .groupBy('day', 'source')
    .orderBy('day', 'desc');
  const days = new Map<string, { day: string; readers: number; views: number; sources: Record<string, number> }>();
  const sources: Record<string, number> = {};
  let readers = 0;
  let views = 0;
  for (const r of rows as any[]) {
    const d = days.get(r.day) || { day: r.day, readers: 0, views: 0, sources: {} as Record<string, number> };
    d.readers += num(r.readers);
    d.views += num(r.views);
    d.sources[r.source] = num(r.readers);
    days.set(r.day, d);
    sources[r.source] = (sources[r.source] || 0) + num(r.readers);
    readers += num(r.readers);
    views += num(r.views);
  }
  const lifetime = await db('articles').where({ document_id: documentId }).whereNotNull('published_at').first('view_count');
  return {
    readers,
    views,
    lifetimeViews: num(lifetime?.view_count),
    bySource: Object.entries(sources)
      .map(([source, n]) => ({ source, name: SOURCE_NAMES[source as Source] || source, readers: n }))
      .sort((a, b) => b.readers - a.readers),
    byDay: [...days.values()],
  };
}

// ---- Emailed recaps ----

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const n = (v: number) => v.toLocaleString('en-NZ');
const longDay = (day: string) =>
  new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

export async function sendRecap(strapi: Core.Strapi, period: 'day' | 'week') {
  const to = (process.env.STATS_RECAP_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!to.length) return { sent: false, reason: 'STATS_RECAP_TO not set' };
  const end = addDays(isoDay(), -1);
  const range = { from: period === 'day' ? end : addDays(end, -6), to: end };
  const prev = { from: addDays(range.from, period === 'day' ? -7 : -7), to: addDays(range.to, -7) };
  const [now, before, perf] = await Promise.all([overview(strapi, range, 10), overview(strapi, prev, 0), performance(strapi, { from: addDays(range.from, -1), to: range.to })]);
  const site = (process.env.SITE_URL || 'https://harnesslink.com').replace(/\/$/, '');
  const admin = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/admin`;
  const change = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : '');
  const prevBy = new Map(before.bySource.map((s) => [s.source, s.readers]));
  const td = 'padding:6px 8px;border-bottom:1px solid #e5e5e5;';
  const th = `${td}text-align:left;font-weight:600;color:#555;`;
  const storyRow = (s: any, extra: string) =>
    `<tr><td style="${td}"><a href="${site}/${esc(s.slug)}/" style="color:#00205E">${esc(s.title)}</a><br><span style="color:#777;font-size:12px">${esc(s.category || '')}</span></td><td style="${td}text-align:right">${extra}</td></tr>`;
  const sourceCell = (s: Record<string, number>) =>
    Object.entries(s)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${SOURCE_NAMES[k as Source] || k} ${n(v)}`)
      .join(' · ');

  const title = period === 'day' ? `Yesterday on Harnesslink: ${longDay(end)}` : `Week on Harnesslink: ${longDay(range.from)} to ${longDay(range.to)}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:680px">
<h1 style="font-size:20px;color:#00205E;margin:0 0 4px">${esc(title)}</h1>
<p style="margin:0 0 16px;color:#555"><strong style="font-size:18px;color:#222">${n(now.totals.readers)}</strong> readers (${n(now.totals.views)} views) ${
    before.totals.readers ? `<span style="color:#555">${change(now.totals.readers, before.totals.readers)} on the ${period === 'day' ? 'same day last week' : 'week before'}</span>` : ''
  }</p>
<h2 style="font-size:16px;margin:20px 0 6px">Where readers came from</h2>
<table style="border-collapse:collapse;width:100%"><tr><th style="${th}">Source</th><th style="${th}text-align:right">Readers</th><th style="${th}text-align:right">Change</th></tr>
${now.bySource.map((s) => `<tr><td style="${td}">${esc(s.name)}</td><td style="${td}text-align:right">${n(s.readers)}</td><td style="${td}text-align:right;color:#555">${change(s.readers, prevBy.get(s.source) || 0)}</td></tr>`).join('')}
</table>
<h2 style="font-size:16px;margin:20px 0 6px">Most read</h2>
<table style="border-collapse:collapse;width:100%">${now.top.map((s) => storyRow(s, `<strong>${n(s.readers)}</strong><br><span style="color:#777;font-size:12px">${esc(sourceCell(s.sources))}</span>`)).join('')}</table>
<h2 style="font-size:16px;margin:20px 0 6px">Did better than usual for their section</h2>
<p style="margin:0 0 6px;color:#777;font-size:12px">Readers in the first two days, against a normal story in the same section.</p>
<table style="border-collapse:collapse;width:100%">${perf.best.slice(0, period === 'day' ? 5 : 10).map((s) => storyRow(s, `${n(s.firstTwoDays)}<br><span style="color:#777;font-size:12px">${s.index}× usual (${n(s.sectionMedian)})</span>`)).join('') || `<tr><td style="${td}">Not enough stories yet.</td></tr>`}</table>
<h2 style="font-size:16px;margin:20px 0 6px">Did worse than usual</h2>
<table style="border-collapse:collapse;width:100%">${perf.worst.slice(0, period === 'day' ? 5 : 10).map((s) => storyRow(s, `${n(s.firstTwoDays)}<br><span style="color:#777;font-size:12px">${s.index}× usual (${n(s.sectionMedian)})</span>`)).join('') || `<tr><td style="${td}">Not enough stories yet.</td></tr>`}</table>
<p style="margin:24px 0 0;color:#777;font-size:12px">Readers are people who opened a story, counted once per story per day, from every browser including the Facebook, Instagram and X apps. Full figures: <a href="${admin}/story-performance" style="color:#00205E">Story performance</a> in the newsroom.</p>
</div>`;
  await strapi.plugin('email').service('email').send({ to, subject: title, html });
  strapi.log.info(`[story-stats] ${period} recap sent to ${to.length} address(es)`);
  return { sent: true };
}

// ---- Newsroom routes (admin only) ----

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function registerStoryStatsRoutes(strapi: Core.Strapi) {
  const UID = 'api::article.article';
  const allowed = (ctx: any) =>
    !strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model: UID }).cannot.read();
  const rangeOf = (ctx: any) => {
    const to = ISO.test(String(ctx.query.to)) ? String(ctx.query.to) : isoDay();
    const from = ISO.test(String(ctx.query.from)) ? String(ctx.query.from) : addDays(to, -6);
    return from <= to ? { from, to } : { from: to, to: from };
  };
  const config = { policies: ['admin::isAuthenticatedAdmin'] };
  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        method: 'GET',
        path: '/hl-stats/overview',
        config,
        handler: async (ctx: any) => {
          if (!allowed(ctx)) return ctx.forbidden();
          ctx.body = await overview(strapi, rangeOf(ctx), 30);
        },
      },
      {
        method: 'GET',
        path: '/hl-stats/performance',
        config,
        handler: async (ctx: any) => {
          if (!allowed(ctx)) return ctx.forbidden();
          ctx.body = await performance(strapi, rangeOf(ctx));
        },
      },
      {
        method: 'GET',
        path: '/hl-stats/story/:documentId',
        config,
        handler: async (ctx: any) => {
          if (!allowed(ctx)) return ctx.forbidden();
          if (!/^[a-z0-9]{10,64}$/i.test(ctx.params.documentId)) return ctx.badRequest();
          ctx.body = await storyReport(strapi, ctx.params.documentId);
        },
      },
    ],
  } as any);
}
