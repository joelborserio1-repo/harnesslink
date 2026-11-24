import type { Core } from '@strapi/strapi';
import { freeSlug, slugify } from './email-processor';

// Race analysis ("Harness Analyst" previews): a story with a meeting's fields
// attached, pulled from the HarnessLink racing API (admin.harnesslink.com,
// which collects TAB's fields, prices, form, silks and results). The editor's
// selections and comments sit alongside in the story's
// `raceAnalysis` field; the site renders it under the story text
// (web/src/components/analysis/).
//
// The API key stays on the server. Readers' browsers load the silks from TAB
// directly (TAB serves those images to browsers, not to servers) and fresh
// prices and results from GET /api/race-analysis/live/:meetingId, cached here.

const API = () => (process.env.HARNESSLINK_API_URL || 'https://admin.harnesslink.com/api').replace(/\/$/, '');

export async function api(path: string) {
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
  horseId?: number | null;
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
export type RaceNotes = { picks: Pick[]; note?: string; map?: { rail: number[]; outside: number[]; three?: number[] } | null; aiDrafted?: boolean };
export type RaceAnalysis = {
  meeting: Meeting;
  notes: Record<string, RaceNotes>;
  bestBet?: { race: number; no: number } | null;
  bestValue?: { race: number; no: number } | null;
  aiDraft?: { status: 'running' | 'done' | 'failed'; startedAt?: string; at?: string; error?: string; model?: string; by?: string | null } | null;
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
    horseId: e.horse_id ? Number(e.horse_id) : null,
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

export function normRace(r: any): Race {
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
  if (!m.track_condition) {
    try {
      const list: any[] = await api('/meetings?when=all&limit=300');
      m.track_condition = list.find((x) => Number(x.id) === Number(meetingId))?.track_condition || null;
    } catch {}
  }
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

// ---------- tracks and weather ----------

// The track guide for a TAB venue name ("Menangle", "Cambridge"…): Tracks
// list the venue names they go by.
export async function trackFor(strapi: Core.Strapi, venue: string) {
  const v = venue.trim().toLowerCase();
  const all: any[] = await strapi.documents('api::track.track').findMany({ populate: { starts: true, records: true }, limit: 500 } as any);
  return all.find((t) => String(t.venueNames || '').split(',').some((n: string) => n.trim().toLowerCase() === v)) || null;
}

// Open-Meteo (free, no key): the weather at the track on race night, hour by
// hour, read at the first race. Works for past meetings (its archive of
// recent days) and coming ones (forecast up to 16 days). The place comes from
// the Track's coordinates, or Open-Meteo's place search on the venue name.
const geoCache = new Map<string, { lat: number; lng: number; place: string } | null>();
async function placeOf(venue: string, country: string, tz: string) {
  const key = `${venue}|${country}|${tz}`;
  if (geoCache.has(key)) return geoCache.get(key)!;
  const q = new URLSearchParams({ name: venue, count: '10', language: 'en', format: 'json', countryCode: country });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`, { signal: AbortSignal.timeout(8_000) });
  const d: any = res.ok ? await res.json() : null;
  // Several towns share a name (Redcliffe QLD and WA): take the one in the meeting's time zone.
  const results: any[] = d?.results || [];
  const hit = results.find((r) => r.timezone === tz) || results[0];
  const out = hit ? { lat: Number(hit.latitude), lng: Number(hit.longitude), place: [hit.name, hit.admin1].filter(Boolean).join(', ') } : null;
  geoCache.set(key, out);
  return out;
}

const weatherCache = new Map<string, { at: number; body: any }>();
async function raceNightWeather(lat: number, lng: number, date: string, firstRace: string | null, tz: string, place: string) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${date}`;
  const hit = weatherCache.get(key);
  const past = date < new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  if (hit && Date.now() - hit.at < (past ? 24 * 3_600_000 : 15 * 60_000)) return hit.body;
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: 'temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunset',
    timezone: tz,
    start_date: date,
    end_date: date,
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const d: any = await res.json();
  const hours: string[] = d.hourly?.time || [];
  const localHour = firstRace
    ? Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(firstRace)))
    : 18;
  const i = Math.max(0, hours.findIndex((t) => Number(t.slice(11, 13)) === localHour));
  const h = (k: string) => d.hourly?.[k]?.[i] ?? null;
  // Rain over the race meeting: first race hour to four hours on.
  const rainMeeting = (d.hourly?.precipitation || []).slice(i, i + 5).reduce((t: number, v: number) => t + (v || 0), 0);
  const body = {
    place,
    past,
    hour: hours[i] || null,
    temp: h('temperature_2m'),
    feels: h('apparent_temperature'),
    code: h('weather_code'),
    humidity: h('relative_humidity_2m'),
    rainChance: h('precipitation_probability') ?? d.daily?.precipitation_probability_max?.[0] ?? null,
    wind: h('wind_speed_10m'),
    gusts: h('wind_gusts_10m'),
    windFrom: h('wind_direction_10m'),
    max: d.daily?.temperature_2m_max?.[0] ?? null,
    min: d.daily?.temperature_2m_min?.[0] ?? null,
    dayCode: d.daily?.weather_code?.[0] ?? null,
    rainDay: d.daily?.precipitation_sum?.[0] ?? null,
    rainMeeting: Math.round(rainMeeting * 10) / 10,
    sunset: d.daily?.sunset?.[0] ?? null,
  };
  weatherCache.set(key, { at: Date.now(), body });
  return body;
}

// Track guides to start from. Menangle's figures are from the Harnesslink
// track-guide mockup (Nov 2026); editors check and complete them under Tracks.
export async function seedTracks(strapi: Core.Strapi) {
  const uid = 'api::track.track';
  const existing = await strapi.db.connection('tracks').where('slug', 'menangle-park-paceway').first('id');
  if (existing) return;
  const rec = (gait: string, distance: number, start: string, mileRate: string, horse: string, date: string) => ({ gait, distance, start, mileRate, horse, date });
  await strapi.documents(uid).create({
    data: {
      name: 'Menangle Park Paceway',
      slug: 'menangle-park-paceway',
      venueNames: 'Menangle, Menangle Park, Tabcorp Park Menangle',
      country: 'AU',
      region: 'NSW',
      circumference: 1400,
      straight: 350,
      direction: 'anticlockwise',
      sprintLane: false,
      fieldLimitMobile: 12,
      frontLineMobile: 10,
      latitude: -34.113,
      longitude: 150.743,
      starts: [
        { distance: 1609, mobile: true, standing: true },
        { distance: 2300, mobile: true, standing: true },
      ],
      records: [
        rec('pace', 1609, 'mobile', '1:46.9', 'My Field Marshal NZ', '2018-02-24'),
        rec('pace', 2300, 'mobile', '1:50.5', 'Don Hugo', '2024-12-14'),
        rec('pace', 1609, 'standing', '1:55.4', 'Our Chain Of Command NZ', '2012-06-24'),
        rec('pace', 2300, 'standing', '1:55.8', 'Terrorway NZ', '2013-01-19'),
        rec('trot', 1609, 'mobile', '1:51.5', 'Maori Time', '2018-02-24'),
        rec('trot', 2300, 'mobile', '1:55.3', 'The Locomotive', '2024-12-14'),
        rec('trot', 1609, 'standing', '1:55.9', 'Chief Runningcloud', '2026-10-13'),
        rec('trot', 2300, 'standing', '1:57.2', 'Hot To Trot NZ', '2025-05-06'),
      ],
      notes: 'Figures from the Harnesslink track-guide mockup, November 2026. Check before relying on them.',
    } as never,
  });
  strapi.log.info('[tracks] seeded Menangle Park Paceway');
}

// Prices, scratchings and results only: what changes after the editor pulled.
const liveCache = new Map<number, { at: number; body: any }>();
const inflight = new Map<number, Promise<any>>();
async function live(strapi: Core.Strapi, meetingId: number) {
  const hit = liveCache.get(meetingId);
  if (hit && Date.now() - hit.at < 120_000) return hit.body;
  if (inflight.has(meetingId)) return inflight.get(meetingId);
  const p = (async () => {
    try {
      const m = await pullMeeting(meetingId);
      let weather = null;
      try {
        const t = await trackFor(strapi, m.venue);
        const spot = t?.latitude && t?.longitude ? { lat: Number(t.latitude), lng: Number(t.longitude), place: t.name } : await placeOf(m.venue, m.country, m.timezone);
        const first = m.races.find((r) => r.startTime)?.startTime || null;
        if (spot) weather = await raceNightWeather(spot.lat, spot.lng, m.date, first, m.timezone, spot.place);
      } catch (e) {
        strapi.log.warn(`[race-analysis] weather for ${m.venue}: ${(e as Error).message}`);
      }
      const body = {
        at: m.pulledAt,
        trackCondition: m.trackCondition,
        weather,
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
      // Claude drafts tips and best bet/value (src/race-tips.ts).
      {
        method: 'POST',
        path: '/hl-analysis/stories/:documentId/draft-tips',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'update')) return ctx.forbidden();
          try {
            const { draftTips } = await import('./race-tips');
            ctx.status = 202;
            ctx.body = await draftTips(strapi, ctx.params.documentId, { overwrite: !!ctx.request.body?.overwrite, userEmail: ctx.state.user?.email });
          } catch (e) {
            fail(ctx, e);
          }
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
            ctx.body = { documentId: (await createAnalysisStory(strapi, meetingId)).documentId };
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
    ],
  } as any);

  const db = () => strapi.db.connection;
}

const timeAt = (iso: string | null | undefined, tz: string) =>
  iso ? new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date(iso)).replace(' ', '') : null;
const weekday = (iso: string) => new Intl.DateTimeFormat('en-NZ', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

// A new analysis story for a meeting, as a draft with the fields attached.
// `formGuide`: the daily form guide's card (src/form-guide.ts), served at
// /form-guide/<venue>-<day>-<month>-<year>/ rather than at the root.
export async function createAnalysisStory(strapi: Core.Strapi, meetingId: number, opts: { formGuide?: boolean; withTips?: boolean } = {}) {
  const UID = 'api::article.article';
  const meeting = await pullMeeting(meetingId);
  const db = strapi.db.connection;
  const day = fmtDay(meeting.date);
  const category = await db('categories').where('name', COUNTRY_CATEGORY[meeting.country] || 'International').whereNotNull('published_at').first('document_id');
  const author = await db('authors').whereRaw(`lower(name) = 'harness analyst'`).first('document_id');
  const firstTime = timeAt(meeting.races.find((r) => r.startTime)?.startTime, meeting.timezone);
  const card = `<strong>${meeting.venue}</strong> with ${meeting.races.length} races on the card${firstTime ? `, starting at <strong>${firstTime}</strong>` : ''}`;
  const fg = !!opts.formGuide;
  const title = fg ? `${meeting.venue} form guide and tips, ${weekday(meeting.date)} ${day}` : `Harness Analyst: ${meeting.venue} preview, ${day}`;
  const intro = fg
    ? `<p>Harness racing heads to ${card}. Below are the full fields, form and the latest TAB prices for every race${
        opts.withTips === false ? ", with our Harness Analyst's selections added once they are checked" : ", with our Harness Analyst's best bet, value runner and selections"
      }. Prices, scratchings and results update on this page through the day.</p>`
    : `<p>Harness racing heads to ${card}. Our analyst's best bet, value runner and selections for every race are below, with the full fields, form and the latest TAB prices.</p>`;
  const base = fg ? `form-guide-${meeting.venue}-${day}-${meeting.date.slice(0, 4)}` : `harness-analyst-${meeting.venue}-${meeting.date}`;
  const doc = await strapi.documents(UID).create({
    data: {
      title,
      slug: await freeSlug(strapi, slugify(base), 'articles'),
      excerpt: fg
        ? `Fields, form, TAB prices, tips and results for every race at ${meeting.venue}, ${weekday(meeting.date)} ${day}.`
        : `Best bet, value runner and selections for every race at ${meeting.venue}, ${day}.`,
      bodyFormat: 'legacy_html',
      bodyHtml: intro,
      needsReview: true,
      raceAnalysis: { meeting, notes: {}, bestBet: null, bestValue: null },
      ...(category ? { primaryCategory: category.document_id, categories: [category.document_id] } : {}),
      ...(author ? { authors: [author.document_id] } : {}),
      seo: { metaTitle: `${meeting.venue} harness form guide & tips, ${day} ${meeting.date.slice(0, 4)}`.slice(0, 70) },
      importFlags: { source: fg ? 'form-guide' : 'race-analysis', meetingId },
    } as never,
  });
  return { documentId: doc.documentId as string, meeting };
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
    ctx.body = await live(strapi, id);
  } catch (e: any) {
    ctx.status = 502;
    ctx.body = { error: { message: e?.message || 'Racing API error' } };
  }
}
