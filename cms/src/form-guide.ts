import type { Core } from '@strapi/strapi';
import { api, createAnalysisStory } from './race-analysis';

// The daily form guide: every AU and NZ harness meeting on the TAB gets its own
// card each racing morning (the same layout as the Harness Analyst's
// previews), listed at /form-guide/ and served at
// /form-guide/<venue>-<day>-<month>-<year>/.
//
// Each morning (config/cron-tasks.ts):
// 1. a card is created for each of today's meetings that doesn't have one,
// 2. it is published straight away with the fields, form and TAB prices
//    (prices, scratchings and results then update live on the page),
// 3. Claude drafts the tips into the card's draft version. They go live only
//    when an editor checks them and presses Publish.
//
// `withTips: true` publishes Claude's tips without that check (used on request
// for a given day).

const UID = 'api::article.article';
const COUNTRIES = new Set(['AU', 'NZ']);

const nzDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(d);

let busy = false;

export async function buildDailyFormGuide(strapi: Core.Strapi, opts: { date?: string; withTips?: boolean } = {}) {
  if (busy) return { skipped: 'already running' };
  if (process.env.FORM_GUIDE_ENABLED === 'false') return { skipped: 'disabled' };
  busy = true;
  const date = opts.date || nzDate();
  const report: { venue: string; slug?: string; status: string }[] = [];
  try {
    const all: any[] = await api('/meetings?when=all&limit=300');
    const meetings = all
      .filter((m) => m.meeting_date === date && COUNTRIES.has(m.country) && Number(m.race_count) > 0)
      .sort((a, b) => String(a.first_race_time || '').localeCompare(String(b.first_race_time || '')));
    if (!meetings.length) {
      strapi.log.info(`[form-guide] ${date}: no AU/NZ meetings`);
      return { date, report };
    }
    const existing = await strapi.db
      .connection('articles')
      .whereNotNull('race_analysis')
      .whereRaw(`(race_analysis->'meeting'->>'id')::int = any(?)`, [meetings.map((m) => Number(m.id))])
      .select(strapi.db.connection.raw(`distinct (race_analysis->'meeting'->>'id')::int as id`));
    const have = new Set(existing.map((r: any) => Number(r.id)));

    for (const m of meetings) {
      if (have.has(Number(m.id))) {
        report.push({ venue: m.venue, status: 'already has a story' });
        continue;
      }
      try {
        const { documentId } = await createAnalysisStory(strapi, Number(m.id), { formGuide: true, withTips: !!opts.withTips });
        const { draftTips } = await import('./race-tips');
        if (!opts.withTips) await strapi.documents(UID).publish({ documentId });
        let tips = 'no Claude key';
        if (process.env.ANTHROPIC_API_KEY) {
          await draftTips(strapi, documentId, { overwrite: false, userEmail: 'form-guide', wait: true });
          const d: any = await strapi.documents(UID).findOne({ documentId, status: 'draft', fields: ['raceAnalysis'] as any });
          tips = d?.raceAnalysis?.aiDraft?.status === 'done' ? 'tips drafted' : `tips failed: ${d?.raceAnalysis?.aiDraft?.error || 'unknown'}`;
        }
        if (opts.withTips) await strapi.documents(UID).publish({ documentId });
        const pub: any = await strapi.documents(UID).findOne({ documentId, status: 'published', fields: ['slug'] as any });
        report.push({ venue: m.venue, slug: pub?.slug, status: opts.withTips ? `published with ${tips}` : `published; ${tips}, waiting for an editor` });
      } catch (e: any) {
        report.push({ venue: m.venue, status: `failed: ${e?.message || e}` });
      }
    }
    strapi.log.info(`[form-guide] ${date}: ${report.map((r) => `${r.venue} (${r.status})`).join('; ')}`);
    return { date, report };
  } finally {
    busy = false;
  }
}

// Public list for /form-guide/: published cards from `days` days back to the
// furthest day ahead, compact (no fields).
export async function formGuideList(strapi: Core.Strapi, days = 3) {
  const since = nzDate(new Date(Date.now() - days * 86_400_000));
  const rows = await strapi.db
    .connection('articles')
    .whereNotNull('published_at')
    .where('slug', 'like', 'form-guide-%')
    .whereRaw(`race_analysis->'meeting'->>'date' >= ?`, [since])
    .select(
      'slug',
      'title',
      strapi.db.connection.raw(`race_analysis->'meeting'->>'id' as meeting_id`),
      strapi.db.connection.raw(`race_analysis->'meeting'->>'date' as date`),
      strapi.db.connection.raw(`race_analysis->'meeting'->>'venue' as venue`),
      strapi.db.connection.raw(`race_analysis->'meeting'->>'country' as country`),
      strapi.db.connection.raw(`race_analysis->'meeting'->>'timezone' as timezone`),
      strapi.db.connection.raw(`race_analysis->'meeting'->>'trackCondition' as track_condition`),
      strapi.db.connection.raw(`jsonb_array_length(race_analysis->'meeting'->'races') as races`),
      strapi.db.connection.raw(`race_analysis->'meeting'->'races'->0->>'startTime' as first_race`),
      strapi.db.connection.raw(`race_analysis->'bestBet'->>'race' as best_race`),
      strapi.db.connection.raw(
        `(select e->>'horse' from jsonb_array_elements(race_analysis->'meeting'->'races') r, jsonb_array_elements(r->'entries') e
          where (r->>'no')::int = (race_analysis->'bestBet'->>'race')::int and (e->>'no')::int = (race_analysis->'bestBet'->>'no')::int limit 1) as best_horse`
      ),
      strapi.db.connection.raw(`(select count(*) from jsonb_each(coalesce(race_analysis->'notes','{}'::jsonb)) n where jsonb_array_length(coalesce(n.value->'picks','[]'::jsonb)) > 0) as tipped`)
    );
  return rows
    .map((r: any) => ({
      slug: r.slug,
      path: `/form-guide/${String(r.slug).replace(/^form-guide-/, '')}/`,
      title: r.title,
      meetingId: Number(r.meeting_id),
      date: r.date,
      venue: r.venue,
      country: r.country,
      timezone: r.timezone,
      trackCondition: r.track_condition,
      races: Number(r.races),
      firstRace: r.first_race,
      hasTips: Number(r.tipped) > 0,
      bestBet: r.best_horse ? { race: Number(r.best_race), horse: r.best_horse } : null,
    }))
    .sort((a: any, b: any) => (a.date === b.date ? String(a.firstRace).localeCompare(String(b.firstRace)) : b.date.localeCompare(a.date)));
}
