import type { Core } from '@strapi/strapi';
import { freeSlug, slugify } from './email-processor';

// Race analysis ("Harness Analyst" previews): a story with a meeting's fields
// attached, pulled from the HarnessLink racing API (admin.harnesslink.com,
// which collects TAB's fields, prices, form, silks and results). The editor's
// selections, comments and speed maps sit alongside in the story's
// `raceAnalysis` field; the site renders it under the story text
// (web/src/components/analysis/).
//
// The API key stays on the server. Readers' browsers load the silks from TAB
// directly (TAB serves those images to browsers, not to servers) and fresh
// prices and results from GET /api/race-analysis/live/:meetingId, cached here.

const API = () => (process.env.HARNESSLINK_API_URL || 'https://admin.harnesslink.com/api').replace(/\/$/, '');

async function api(path: string) {
  const key = process.env.HARNESSLINK_API_KEY;
  if (!key) throw Object.assign(new Error('The racing API key (HARNESSLINK_API_KEY) is not set'), { status: 503 });
  const res = await fetch(`${API()}/v1/racing${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) throw Object.assign(new Error('Not found in the racing API'), { status: 404 });
  if (!res.ok) throw Object.assign(new Error(`Racing API answered ${res.status}`), { status: 502 });
  return res.json() as Promise<any>;
}

export type Entry = {
  no: number;
  barrier: string | null;
  handicap: number | null;
  horse: string;
  driver: string | null;
  trainer: string | null;
  junior: boolean;
  silk: string | null; // TAB path, e.g. /v1/tab-info-service/racing/silk/…
  colours: string | null;
  form: string | null;
  comment: string | null;
  win: number | null; // TAB fixed odds
  place: number | null;
  toteWin: number | null;
  scratched: boolean;
  emergency: boolean;
  gearOn: string | null;
  gearOff: string | null;
  placing: string | null;
  margin: string | null;
};
export type Race = {
  id: number;
  no: number;
  name: string;
  distance: number | null;
  start: 'mobile' | 'standing' | null;
  gait: 'trot' | 'pace';
  className: string | null;
  stakes: number | null;
  startTime: string | null;
  status: string | null;
  resulted: boolean;
  dividends: string | null;
  mileRate: string | null;
  winTime: string | null;
  entries: Entry[];
};
export type Meeting = {
  id: number;
  date: string;
  venue: string;
  country: string;
  timezone: string;
  trackCondition: string | null;
  races: Race[];
  pulledAt: string;
};

// Editor's layer, keyed by race id so it survives a re-pull.
export type Pick = { no: number; comment: string };
export type RaceNotes = { picks: Pick[]; note?: string; map?: { rail: number[]; outside: number[]; three?: number[] } | null };
export type RaceAnalysis = {
  meeting: Meeting;
  notes: Record<string, RaceNotes>;
  bestBet?: { race: number; no: number } | null;
  bestValue?: { race: number; no: number } | null;
};

const price = (e: any, type: string) => {
  const p = (e.latest_prices || []).find((x: any) => x.market_type === type);
  const v = Number(p?.price);
  return v > 1 ? v : null;
};

// TAB writes most names in capitals; readers get them in normal case.
const tidyName = (s: string | null | undefined) => {
  const t = String(s || '').trim();
  if (!t) return null;
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bMc([a-z])/g, (_m, c) => `Mc${c.toUpperCase()}`).replace(/'([A-Z])/g, (_m, c) => `'${c.toLowerCase()}`);
};

const silkPath = (p: string | null | undefined) => (p ? String(p).replace(/^\/tab(?=\/v1\/)/, '') : null);

function normEntry(e: any): Entry {
  return {
    no: Number(e.saddlecloth),
    barrier: e.barrier == null ? null : String(e.barrier),
    handicap: e.handicap_m == null ? null : Number(e.handicap_m),
    horse: String(e.horse_name || '').trim(),
    driver: tidyName(e.driver_name),
    trainer: tidyName(e.trainer_name),
    junior: !!e.driver_is_junior,
    silk: silkPath(e.colours_image),
    colours: e.colours || (e.colours_image ? decodeURIComponent(String(e.colours_image).split('/silk/')[1] || '') : null) || null,
    form: e.form || null,
    comment: e.form_comment || null,
    win: price(e, 'win'),
    place: price(e, 'place'),
    toteWin: price(e, 'tote_win'),
    scratched: !!e.scratched,
    emergency: !!e.emergency,
    gearOn: e.gear_on || null,
    gearOff: e.gear_off || null,
    placing: e.placing || null,
    margin: e.margin_lengths == null ? null : String(e.margin_lengths),
  };
}

function normRace(r: any): Race {
  const name = String(r.name || '').trim();
  const st = String(r.start_type || '').toLowerCase();
  const start = st.startsWith('m') ? 'mobile' : st.startsWith('s') ? 'standing' : /\bMs$/i.test(name) ? 'mobile' : /\bSs$/i.test(name) ? 'standing' : null;
  const gaitRaw = String(r.gait || '').toLowerCase();
  return {
    id: Number(r.id),
    no: Number(r.race_number),
    name,
    distance: r.distance_m ? Number(r.distance_m) : null,
    start,
    gait: gaitRaw.startsWith('t') || /\btrot/i.test(name) ? 'trot' : 'pace',
    className: r.class_short || null,
    stakes: Number(r.stakes_total) || null,
    startTime: r.start_time || null,
    status: r.status || null,
    resulted: /result|final|paying|interim|closed/i.test(`${r.status} ${r.tab_status}`) && (r.entries || []).some((e: any) => e.placing),
    dividends: r.dividends_text || null,
    mileRate: r.mile_rate || null,
    winTime: r.win_time || null,
    entries: (r.entries || []).map(normEntry).filter((e: Entry) => e.no > 0).sort((a: Entry, b: Entry) => a.no - b.no),
  };
}

export async function pullMeeting(meetingId: number): Promise<Meeting> {
  const m = await api(`/meetings/${meetingId}`);
  const races: Race[] = [];
  for (const r of m.races || []) races.push(normRace(await api(`/races/${r.id}`)));
  races.sort((a, b) => a.no - b.no);
  return {
    id: Number(m.id),
    date: m.meeting_date,
    venue: m.venue,
    country: m.country,
    timezone: m.timezone || 'Pacific/Auckland',
    trackCondition: m.track_condition || null,
    races,
    pulledAt: new Date().toISOString(),
  };
}

// Prices, scratchings and results only: what changes after the editor pulled.
const liveCache = new Map<number, { at: number; body: any }>();
const inflight = new Map<number, Promise<any>>();
async function live(meetingId: number) {
  const hit = liveCache.get(meetingId);
  if (hit && Date.now() - hit.at < 120_000) return hit.body;
  if (inflight.has(meetingId)) return inflight.get(meetingId);
  const p = (async () => {
    try {
      const m = await pullMeeting(meetingId);
      const body = {
        at: m.pulledAt,
        trackCondition: m.trackCondition,
        races: Object.fromEntries(
          m.races.map((r) => [
            r.id,
            {
              status: r.status,
              resulted: r.resulted,
              dividends: r.dividends,
              entries: Object.fromEntries(
                r.entries.map((e) => [e.no, { win: e.win, place: e.place, toteWin: e.toteWin, scratched: e.scratched, placing: e.placing, margin: e.margin }])
              ),
            },
          ])
        ),
      };
      liveCache.set(meetingId, { at: Date.now(), body });
      if (liveCache.size > 200) liveCache.delete(liveCache.keys().next().value as number);
      return body;
    } finally {
      inflight.delete(meetingId);
    }
  })();
  inflight.set(meetingId, p);
  return p;
}

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
const COUNTRY_CATEGORY: Record<string, string> = { NZ: 'New Zealand', AU: 'Australia', US: 'USA', CA: 'Canada' };

export function registerRaceAnalysisRoutes(strapi: Core.Strapi) {
  const UID = 'api::article.article';
  const can = (ctx: any, action: 'read' | 'update' | 'create') =>
    !strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model: UID }).cannot[action]();
  const fail = (ctx: any, e: any) => {
    ctx.status = e?.status && e.status < 600 ? e.status : 502;
    ctx.body = { error: { message: e?.message || 'Racing API error' } };
  };
  const config = { policies: ['admin::isAuthenticatedAdmin'] };

  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      // Meetings to choose from: the last week and anything coming up, plus
      // which ones already have an analysis story.
      {
        method: 'GET',
        path: '/hl-analysis/meetings',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'read')) return ctx.forbidden();
          try {
            const all: any[] = await api('/meetings?when=all&limit=300');
            const since = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
            const meetings = all.filter((m) => m.meeting_date >= since).sort((a, b) => (a.meeting_date === b.meeting_date ? a.venue.localeCompare(b.venue) : b.meeting_date.localeCompare(a.meeting_date)));
            const rows = await strapi.db
              .connection('articles')
              .whereNotNull('race_analysis')
              .whereRaw(`(race_analysis->'meeting'->>'id')::int = any(?)`, [meetings.map((m) => Number(m.id))])
              .select('document_id', 'title', 'published_at', db().raw(`(race_analysis->'meeting'->>'id')::int as meeting_id`));
            const stories = new Map<number, any>();
            for (const r of rows) {
              const s = stories.get(r.meeting_id);
              if (!s || r.published_at) stories.set(r.meeting_id, { documentId: r.document_id, title: r.title, published: !!r.published_at || !!s?.published });
            }
            ctx.body = meetings.map((m) => ({
              id: m.id,
              date: m.meeting_date,
              venue: m.venue,
              country: m.country,
              races: m.race_count,
              trackCondition: m.track_condition || null,
              story: stories.get(Number(m.id)) || null,
            }));
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
      {
        method: 'GET',
        path: '/hl-analysis/meetings/:id',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'read')) return ctx.forbidden();
          try {
            ctx.body = await pullMeeting(Number(ctx.params.id));
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
      // A story's analysis (draft version: what the editor is working on).
      {
        method: 'GET',
        path: '/hl-analysis/stories/:documentId',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'read')) return ctx.forbidden();
          const doc: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId, status: 'draft', fields: ['title', 'slug', 'raceAnalysis'] as any });
          if (!doc) return ctx.notFound();
          const pub: any = await strapi.documents(UID).findOne({ documentId: ctx.params.documentId, status: 'published', fields: ['slug'] as any });
          ctx.body = { documentId: doc.documentId, title: doc.title, slug: pub?.slug || doc.slug, published: !!pub, raceAnalysis: doc.raceAnalysis || null };
        },
      },
      {
        method: 'PUT',
        path: '/hl-analysis/stories/:documentId',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'update')) return ctx.forbidden();
          const ra = ctx.request.body?.raceAnalysis;
          if (!ra?.meeting?.id || !Array.isArray(ra.meeting.races)) return ctx.badRequest('No meeting in the analysis');
          if (JSON.stringify(ra).length > 1_500_000) return ctx.badRequest('Analysis too large');
          await strapi.documents(UID).update({ documentId: ctx.params.documentId, data: { raceAnalysis: ra } as never });
          ctx.body = { ok: true };
        },
      },
      // New analysis story for a meeting: a draft with the fields attached.
      {
        method: 'POST',
        path: '/hl-analysis/stories',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'create')) return ctx.forbidden();
          const meetingId = Number(ctx.request.body?.meetingId);
          if (!meetingId) return ctx.badRequest('meetingId is required');
          try {
            const meeting = await pullMeeting(meetingId);
            const db = strapi.db.connection;
            const title = `Harness Analyst: ${meeting.venue} preview, ${fmtDay(meeting.date)}`;
            const category = await db('categories').where('name', COUNTRY_CATEGORY[meeting.country] || 'International').whereNotNull('published_at').first('document_id');
            const author = await db('authors').whereRaw(`lower(name) = 'harness analyst'`).first('document_id');
            const firstRace = meeting.races.find((r) => r.startTime)?.startTime;
            const firstTime = firstRace
              ? new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', timeZone: meeting.timezone }).format(new Date(firstRace)).replace(' ', '')
              : null;
            const intro = `<p>Harness racing heads to <strong>${meeting.venue}</strong> with ${meeting.races.length} races on the card${firstTime ? `, starting at <strong>${firstTime}</strong>` : ''}. Our analyst's best bets, value runners and speed maps for every race are below, with the full fields, form and the latest TAB prices.</p>`;
            const doc = await strapi.documents(UID).create({
              data: {
                title,
                slug: await freeSlug(strapi, slugify(`harness-analyst-${meeting.venue}-${meeting.date}`), 'articles'),
                excerpt: `Best bets, value runners and speed maps for every race at ${meeting.venue}, ${fmtDay(meeting.date)}.`,
                bodyFormat: 'legacy_html',
                bodyHtml: intro,
                needsReview: true,
                raceAnalysis: { meeting, notes: {}, bestBet: null, bestValue: null },
                ...(category ? { primaryCategory: category.document_id, categories: [category.document_id] } : {}),
                ...(author ? { authors: [author.document_id] } : {}),
                seo: { metaTitle: `${meeting.venue} harness tips & speed maps, ${fmtDay(meeting.date)}`.slice(0, 70) },
                importFlags: { source: 'race-analysis', meetingId },
              } as never,
            });
            ctx.body = { documentId: doc.documentId };
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
    ],
  } as any);

  const db = () => strapi.db.connection;
}

// Public (src/api/article/routes/01-tracking.ts): fresh prices, scratchings
// and results, only for a meeting with a published analysis, so this can't be
// used to read the whole racing API.
export async function liveForMeeting(strapi: Core.Strapi, ctx: any) {
  const id = Number(ctx.params.meetingId);
  if (!id) return ctx.badRequest();
  const known = await strapi.db
    .connection('articles')
    .whereNotNull('published_at')
    .whereRaw(`(race_analysis->'meeting'->>'id')::int = ?`, [id])
    .first('id');
  if (!known) return ctx.notFound();
  try {
    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = await live(id);
  } catch (e: any) {
    ctx.status = 502;
    ctx.body = { error: { message: e?.message || 'Racing API error' } };
  }
}
