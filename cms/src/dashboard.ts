import type { Core } from '@strapi/strapi';

// Newsroom dashboard for the CMS home screen. One admin-only route per widget:
//   GET /hl-dashboard/traffic | social | racing | newsroom | advertising | sites
// Figures come from our own tools (Matomo, Postiz, the HarnessLink racing API) and the CMS's
// own data. Their keys stay on the server (env); the browser only sees the figures.
// Never calls HRNZ or TAB: racing figures are HarnessLink's stored data.

const TTL_MS = 60_000;
const TIMEOUT_MS = 6_000;
const cache = new Map<string, { at: number; body: unknown }>();

type Off = { connected: false; reason: 'not_configured' | 'unreachable'; error?: string };
const off = (reason: Off['reason'], error?: string): Off => ({ connected: false, reason, ...(error ? { error } : {}) });
const trim = (u?: string) => (u || '').replace(/\/$/, '');

async function getJson(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const nzMidnightUtc = () => {
  const nz = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  // Midnight NZ expressed in UTC: try both offsets (+13 daylight, +12 standard) and keep the one that maps back to the NZ date.
  for (const offset of [13, 12]) {
    const t = new Date(Date.parse(`${nz}T00:00:00Z`) - offset * 3600_000);
    const back = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).format(t);
    if (back.endsWith('00')) return t;
  }
  return new Date(Date.parse(`${nz}T00:00:00Z`) - 13 * 3600_000);
};

async function traffic() {
  const base = trim(process.env.MATOMO_URL);
  const token = process.env.MATOMO_TOKEN;
  const site = process.env.MATOMO_SITE_ID || '1';
  if (!base || !token) return off('not_configured');
  const api = (method: string, params: Record<string, string | number>) =>
    getJson(`${base}/index.php?${new URLSearchParams({ module: 'API', method, idSite: site, format: 'JSON', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token_auth: token }), // token in the body, never the URL
    }).then((r) => {
      if (r && r.result === 'error') throw new Error(r.message || 'Matomo error');
      return r;
    });
  try {
    const [today, week, live, pages, sources] = await Promise.all([
      api('VisitsSummary.get', { period: 'day', date: 'today' }),
      api('VisitsSummary.get', { period: 'range', date: 'last7' }),
      api('Live.getCounters', { lastMinutes: 30 }),
      api('Actions.getPageTitles', { period: 'range', date: 'last7', flat: 1, filter_limit: 6, filter_sort_column: 'nb_hits' }),
      api('Referrers.getReferrerType', { period: 'range', date: 'last7', filter_limit: 5 }),
    ]);
    const sum = (d: any) => ({ visits: d?.nb_visits ?? 0, visitors: d?.nb_uniq_visitors ?? d?.nb_visits ?? 0, pageviews: d?.nb_actions ?? 0 });
    return {
      connected: true,
      link: base,
      now: Array.isArray(live) && live[0] ? Number(live[0].visitors ?? 0) : 0,
      today: sum(today),
      week: sum(week),
      topPages: (pages || []).map((p: any) => ({ title: String(p.label || '').replace(/ \| Harnesslink$/, '').trim(), views: p.nb_hits ?? 0, url: p.url })),
      sources: (sources || []).map((s: any) => ({ label: s.label, visits: s.nb_visits ?? 0 })),
    };
  } catch (e) {
    return off('unreachable', (e as Error).message);
  }
}

async function social() {
  const base = trim(process.env.POSTIZ_URL);
  const key = process.env.POSTIZ_API_KEY;
  if (!base || !key) return off('not_configured');
  const headers = { Authorization: key };
  const now = new Date();
  try {
    const [channels, posts] = await Promise.all([
      getJson(`${base}/api/public/v1/integrations`, { headers }),
      getJson(`${base}/api/public/v1/posts?${new URLSearchParams({
        startDate: new Date(now.getTime() - 7 * 86400_000).toISOString(),
        endDate: new Date(now.getTime() + 14 * 86400_000).toISOString(),
      })}`, { headers }),
    ]);
    const list: any[] = (Array.isArray(posts) ? posts : posts?.posts || []).filter((p: any) => !p.deletedAt);
    const count = (s: string) => list.filter((p) => (p.state || 'QUEUE') === s).length;
    const next = list
      .filter((p) => (p.state || 'QUEUE') === 'QUEUE' && Date.parse(p.publishDate) >= now.getTime())
      .sort((a, b) => Date.parse(a.publishDate) - Date.parse(b.publishDate))
      .slice(0, 3)
      .map((p) => ({ at: p.publishDate, text: String(p.content || '').replace(/<[^>]+>/g, '').slice(0, 140) }));
    return {
      connected: true,
      link: base,
      channels: (channels || []).map((c: any) => ({ name: c.name, network: c.identifier || c.providerIdentifier, disabled: !!c.disabled })),
      scheduled: count('QUEUE'),
      published: count('PUBLISHED'),
      failed: count('ERROR'),
      drafts: count('DRAFT'),
      next,
    };
  } catch (e) {
    return off('unreachable', (e as Error).message);
  }
}

async function racing() {
  const base = trim(process.env.HARNESSLINK_API_URL || 'https://admin.harnesslink.com/api');
  const key = process.env.HARNESSLINK_API_KEY;
  if (!key) return off('not_configured');
  const headers = { Authorization: `Bearer ${key}` };
  try {
    const meetings: any[] = await getJson(`${base}/v1/racing/meetings?when=today&limit=50`, { headers });
    const now = Date.now();
    return {
      connected: true,
      site: process.env.SITE_URL || 'https://staging.harnesslink.com',
      meetings: meetings.length,
      races: meetings.reduce((a, m) => a + (m.race_count || 0), 0),
      resulted: meetings.reduce((a, m) => a + (m.resulted_count || 0), 0),
      byCountry: ['NZ', 'AU'].map((c) => ({ country: c, meetings: meetings.filter((m) => m.country === c).length })),
      next: meetings
        .filter((m) => m.next_race_at && Date.parse(m.next_race_at) > now)
        .sort((a, b) => Date.parse(a.next_race_at) - Date.parse(b.next_race_at))
        .slice(0, 4)
        .map((m) => ({ venue: String(m.venue).replace(/\s+(Raceway|Racecourse|Paceway)$/i, ''), country: m.country, at: m.next_race_at, tz: m.timezone })),
    };
  } catch (e) {
    return off('unreachable', (e as Error).message);
  }
}

async function newsroom(strapi: Core.Strapi) {
  const articles = strapi.documents('api::article.article');
  const since = nzMidnightUtc().toISOString();
  const [publishedToday, allDrafts, allPublished, latest] = await Promise.all([
    articles.count({ status: 'published', filters: { publishedAt: { $gte: since } } } as any),
    articles.count({ status: 'draft' } as any),
    articles.count({ status: 'published' } as any),
    articles.findMany({ status: 'published', sort: 'publishedAt:desc', limit: 5, fields: ['title', 'slug', 'publishedAt'] } as any),
  ]);
  // Every story has a draft version in Strapi 5; ones never published are the difference.
  const neverPublished = Math.max(0, Number(allDrafts) - Number(allPublished));
  const comments = strapi.db.query('plugin::comments.comment');
  let pendingComments = 0;
  let latestComments: { name: string; text: string; at: string }[] = [];
  try {
    pendingComments = await comments.count({ where: { approvalStatus: 'PENDING', $or: [{ removed: false }, { removed: null }] } });
    latestComments = (await comments.findMany({ orderBy: { createdAt: 'desc' }, limit: 3, where: { $or: [{ removed: false }, { removed: null }] } }))
      .map((c: any) => ({ name: c.authorName || 'Reader', text: String(c.content || '').slice(0, 120), at: c.createdAt }));
  } catch {
    // comments plugin missing or not migrated: show stories only
  }
  return {
    connected: true,
    publishedToday,
    drafts: neverPublished,
    pendingComments,
    latest: (latest as any[]).map((a) => ({ title: a.title, slug: a.slug, at: a.publishedAt, documentId: a.documentId })),
    latestComments,
  };
}

async function advertising(strapi: Core.Strapi) {
  const ads = (await strapi.db.query('api::ad.ad').findMany({
    select: ['id', 'documentId', 'name', 'zone', 'active', 'startsAt', 'endsAt', 'impressions', 'clicks', 'publishedAt'],
    limit: 1000,
  })) as any[];
  // One row per ad (published version when there is one).
  const byDoc = new Map<string, any>();
  for (const a of ads) {
    const prev = byDoc.get(a.documentId);
    if (!prev || (a.publishedAt && !prev.publishedAt)) byDoc.set(a.documentId, a);
  }
  const now = Date.now();
  const list = [...byDoc.values()].map((a) => ({
    ...a,
    impressions: Number(a.impressions || 0),
    clicks: Number(a.clicks || 0),
    running: !!a.active && !!a.publishedAt && (!a.startsAt || Date.parse(a.startsAt) <= now) && (!a.endsAt || Date.parse(a.endsAt) > now),
  }));
  const running = list.filter((a) => a.running);
  const impressions = list.reduce((s, a) => s + a.impressions, 0);
  const clicks = list.reduce((s, a) => s + a.clicks, 0);
  const ctr = (c: number, i: number) => (i ? Math.round((c / i) * 10000) / 100 : null);
  return {
    connected: true,
    total: list.length,
    running: running.length,
    impressions,
    clicks,
    ctr: ctr(clicks, impressions),
    top: [...running].sort((a, b) => b.impressions - a.impressions).slice(0, 5)
      .map((a) => ({ name: a.name, zone: a.zone, impressions: a.impressions, clicks: a.clicks, ctr: ctr(a.clicks, a.impressions), documentId: a.documentId })),
    endingSoon: running.filter((a) => a.endsAt && Date.parse(a.endsAt) - now < 7 * 86400_000)
      .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
      .map((a) => ({ name: a.name, endsAt: a.endsAt, documentId: a.documentId })),
    zonesWithoutAds: [...new Set(list.map((a) => a.zone))].filter((z) => z && !running.some((a) => a.zone === z)),
  };
}

const SITES = [
  ['Live site', 'https://harnesslink.com/'],
  ['Staging site', 'https://staging.harnesslink.com/'],
  ['Racing admin', 'https://admin.harnesslink.com/login'],
  ['Social (Postiz)', 'https://social.harnesslink.com/auth/login'],
  ['Analytics (Matomo)', 'https://analytics.harnesslink.com/matomo.js'],
] as const;

async function sites() {
  const checks = await Promise.all(
    SITES.map(async ([name, url]) => {
      const t = Date.now();
      try {
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
        return { name, url: url.replace(/(auth\/login|matomo\.js|login)$/, ''), ok: res.status < 400, status: res.status, ms: Date.now() - t };
      } catch {
        return { name, url: url.replace(/(auth\/login|matomo\.js|login)$/, ''), ok: false, status: null, ms: Date.now() - t };
      }
    }),
  );
  return { connected: true, checks };
}

export function registerDashboardRoutes(strapi: Core.Strapi) {
  const sections: Record<string, () => Promise<unknown>> = {
    traffic,
    social,
    racing,
    newsroom: () => newsroom(strapi),
    advertising: () => advertising(strapi),
    sites,
  };
  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        method: 'GET',
        path: '/hl-dashboard/:section',
        handler: async (ctx: any) => {
          const name = String(ctx.params.section);
          const load = sections[name];
          if (!load) return ctx.notFound();
          const hit = cache.get(name);
          if (hit && Date.now() - hit.at < TTL_MS) {
            ctx.body = hit.body;
            return;
          }
          const body = await load().catch((e: Error) => {
            strapi.log.warn(`dashboard ${name}: ${e.message}`);
            return off('unreachable', e.message);
          });
          cache.set(name, { at: Date.now(), body });
          ctx.body = body;
        },
        config: { policies: ['admin::isAuthenticatedAdmin'] },
      },
    ],
  } as any);
}
