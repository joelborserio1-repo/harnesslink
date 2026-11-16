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
// furthest day ahead, compact: each race with our picks (no full fields).
type Pick = { no: number; horse: string; driver: string | null; silk: string | null; colours: string | null; win: number | null; comment?: string };
export async function formGuideList(strapi: Core.Strapi, days = 2) {
  const since = nzDate(new Date(Date.now() - days * 86_400_000));
  const rows = await strapi.db
    .connection('articles')
    .whereNotNull('published_at')
    .where('slug', 'like', 'form-guide-%')
    .whereRaw(`race_analysis->'meeting'->>'date' >= ?`, [since])
    .select('slug', 'title', 'race_analysis');
  const cards = rows.map((r: any) => {
    const ra = r.race_analysis || {};
    const m = ra.meeting || {};
    const notes = ra.notes || {};
    const pick = (race: any, no: number, comment?: string): Pick | null => {
      const e = (race?.entries || []).find((x: any) => x.no === no);
      return e ? { no, horse: e.horse, driver: e.driver, silk: e.silk, colours: e.colours, win: e.win, ...(comment ? { comment } : {}) } : null;
    };
    const races = (m.races || []).map((race: any) => ({
      id: race.id,
      no: race.no,
      name: race.name,
      distance: race.distance,
      start: race.start,
      gait: race.gait,
      startTime: race.startTime,
      starters: (race.entries || []).filter((e: any) => !e.scratched && !e.emergency).length,
      names: Object.fromEntries((race.entries || []).map((e: any) => [e.no, e.horse])),
      picks: ((notes[race.id]?.picks || []) as { no: number }[]).map((p) => pick(race, p.no)).filter(Boolean),
    }));
    const best = (b: any) => {
      const race = b && (m.races || []).find((x: any) => x.no === b.race);
      const comment = race && (notes[race.id]?.picks || []).find((p: any) => p.no === b.no)?.comment;
      const p = race && pick(race, b.no, comment);
      return p ? { race: b.race, raceId: race.id, startTime: race.startTime, ...p } : null;
    };
    return {
      slug: r.slug,
      path: `/form-guide/${String(r.slug).replace(/^form-guide-/, '')}/`,
      title: r.title,
      meetingId: Number(m.id),
      date: m.date,
      venue: m.venue,
      country: m.country,
      timezone: m.timezone,
      trackCondition: m.trackCondition || null,
      firstRace: races.find((x: any) => x.startTime)?.startTime || null,
      races,
      hasTips: races.some((x: any) => x.picks.length),
      bestBet: best(ra.bestBet),
      bestValue: best(ra.bestValue),
    };
  });
  return cards.sort((a: any, b: any) => (a.date === b.date ? String(a.firstRace).localeCompare(String(b.firstRace)) : b.date.localeCompare(a.date)));
}
