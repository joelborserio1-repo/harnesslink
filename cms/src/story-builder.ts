import type { Core } from '@strapi/strapi';
import { api, createAnalysisStory, normRace } from './race-analysis';
import { freeSlug, slugify } from './email-processor';
import { fromTabLink, horseInfo } from './runner-guide';
import { horseSpotlight, meetingWrap, mondayOf, searchHorses, weekCheck, weeklyReview } from './data-stories';

// Story Builder (phase 1): the "New story" screen in the CMS
// (admin/StoryBuilder.tsx). A journalist picks a template from a visual
// library, points it at a race or meeting, sees what the racing API has for
// it, and gets a draft story set up by the code that already builds that
// format (race map: src/race-map.ts; runner guide: src/runner-guide.ts;
// Harness Analyst: src/race-analysis.ts; meeting wrap, horse spotlight and
// weekly review: src/data-stories.ts).

const ARTICLE = 'api::article.article';

export type TemplateStatus = 'live' | 'development' | 'awaiting-data';
export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: TemplateStatus;
  needs: 'none' | 'race' | 'meeting' | 'results' | 'horse' | 'week';
  data: string[]; // automated data it fills
  ai: string | null; // what Claude can draft, if anything
  example: string | null; // a published story on this site rendered with the template (the preview)
  components: ('raceMap' | 'runnerGuide' | 'raceAnalysis')[];
};

export const CATEGORIES = [
  'Standard Editorial',
  'Race Analysis & Previews',
  'Race Results & Reviews',
  'Horse, Driver & Trainer Features',
  'Breeding & Bloodstock',
  'Major Race & Series Coverage',
  'Statistics & Recurring Content',
];

// The template registry. "live" templates create a working draft; the others
// are listed so editors can see what is coming, and cannot be started.
export const TEMPLATES: Template[] = [
  {
    id: 'standard',
    name: 'Standard news story',
    category: 'Standard Editorial',
    description: 'Headline, story text, photos and byline. Straight into the story editor.',
    status: 'live',
    needs: 'none',
    data: [],
    ai: null,
    example: '/larsen-trio-heads-to-winton/',
    components: [],
  },
  {
    id: 'race-map',
    name: 'Race map',
    category: 'Race Analysis & Previews',
    description: 'The HarnessLink race map: every horse in its expected settling position, runner by runner, and the field at a glance.',
    status: 'live',
    needs: 'race',
    data: ['Field, drivers and trainers (TAB)', 'TAB fixed odds', 'Silks and horse colours', 'Scratchings', 'A first map from the draw and the market'],
    ai: 'The map, the text around it and a comment on every runner',
    example: '/race-map-menangle-park-community-pace-24-november-2026/',
    components: ['raceMap'],
  },
  {
    id: 'runner-guide',
    name: 'Runner guide',
    category: 'Race Analysis & Previews',
    description: 'The case for and against every runner: race header, jump links, a card per runner with For, Against and our comment.',
    status: 'live',
    needs: 'race',
    data: ['Race details (TAB)', 'Field, drivers and trainers', 'TAB fixed odds', 'Silks', 'Sex of each horse', 'Emergencies'],
    ai: 'For, Against and the HL comment for every runner',
    example: '/case-for-and-against-menangle-park-community-pace-24-november-2026/',
    components: ['runnerGuide'],
  },
  {
    id: 'feature-race-preview',
    name: 'Feature race preview',
    category: 'Major Race & Series Coverage',
    description: 'A big-race preview with both the race map and the runner guide for the same race, set up together.',
    status: 'live',
    needs: 'race',
    data: ['Everything the race map and runner guide fill, fetched once'],
    ai: 'The map, runner comments, and For / Against',
    example: '/race-map-menangle-park-community-pace-24-november-2026/',
    components: ['raceMap', 'runnerGuide'],
  },
  {
    id: 'meeting-preview',
    name: 'Harness Analyst meeting preview',
    category: 'Race Analysis & Previews',
    description: 'Every race at a meeting: fields, form, prices, speed maps and three selections per race, with a best bet and best value.',
    status: 'live',
    needs: 'meeting',
    data: ['Every race and runner at the meeting (TAB)', 'Form and TAB comments', 'Prices', 'Track guide and weather'],
    ai: 'Three selections per race with comments, best bet and best value',
    example: '/harness-analyst-redcliffe-16-november/',
    components: ['raceAnalysis'],
  },
  {
    id: 'meeting-wrap',
    name: 'Meeting wrap',
    category: 'Race Results & Reviews',
    description: 'Every winner at a meeting with placegetters, margins, times and dividends, ready for you to add the stories of the night.',
    status: 'live',
    needs: 'results',
    data: ['Winners, placegetters and margins (TAB)', 'Winning times and mile rates', 'Dividends', 'Track condition'],
    ai: null,
    example: '/menangle-results-saturday-21-november/',
    components: [],
  },
  {
    id: 'horse-spotlight',
    name: 'Horse spotlight',
    category: 'Horse, Driver & Trainer Features',
    description: 'A profile of one horse: breeding, trainer, career record and recent runs, ready for your story.',
    status: 'live',
    needs: 'horse',
    data: ['Sex, colour, sire and dam (TAB horse record)', 'Trainer', 'Career record', 'Last 10 runs'],
    ai: null,
    example: '/horse-spotlight-leap-to-fame/',
    components: [],
  },
  {
    id: 'breeding-feature',
    name: 'Breeding feature',
    category: 'Breeding & Bloodstock',
    description: 'Sires, dams and families behind a race or a crop of winners.',
    status: 'awaiting-data',
    needs: 'none',
    data: ['Needs a breeding and stallion data source'],
    ai: null,
    example: null,
    components: [],
  },
  {
    id: 'weekly-review',
    name: 'Weekly racing review',
    category: 'Statistics & Recurring Content',
    description: 'The week in harness racing: leading drivers and trainers, horses that won more than once, and every meeting raced.',
    status: 'live',
    needs: 'week',
    data: ['Every resulted meeting in the week (TAB)', 'Winners per meeting', 'Leading drivers and trainers by wins'],
    ai: null,
    example: '/the-week-in-harness-racing-16-nov-to-22-nov/',
    components: [],
  },
];

// ---------- the race picked in the builder ----------

type Pick = { tabLink?: string; meetingId?: number; raceNumber?: number };

async function meetingFor(pick: Pick) {
  if (pick.tabLink) {
    const t = await fromTabLink(pick.tabLink);
    if (typeof t === 'string') throw Object.assign(new Error(t), { status: 400 });
    const all: any[] = await api('/meetings?when=all&limit=300');
    const m = all.find((x) => x.venue === t.venue && String(x.meeting_date).slice(0, 10) === t.date);
    if (!m) throw Object.assign(new Error('That meeting is not in the racing data yet.'), { status: 404 });
    return { meeting: m, raceNumber: t.race };
  }
  if (!pick.meetingId) throw Object.assign(new Error('Paste a TAB race link or choose a meeting.'), { status: 400 });
  const all: any[] = await api('/meetings?when=all&limit=300');
  const m = all.find((x) => Number(x.id) === Number(pick.meetingId));
  if (!m) throw Object.assign(new Error('That meeting is not in the racing data.'), { status: 404 });
  return { meeting: m, raceNumber: pick.raceNumber };
}

// What the racing API has for the pick: shown before anything is created.
async function summary(pick: Pick, needs: 'race' | 'meeting') {
  const { meeting, raceNumber } = await meetingFor(pick);
  const detail = await api(`/meetings/${meeting.id}`);
  const base = {
    meeting: { id: Number(meeting.id), venue: meeting.venue, date: String(meeting.meeting_date).slice(0, 10), country: meeting.country, races: (detail.races || []).length, timezone: meeting.timezone || null },
    source: 'TAB, via the HarnessLink racing API',
    checkedAt: new Date().toISOString(),
  };
  if (needs === 'meeting') {
    const races = (detail.races || []).map((r: any) => ({ no: Number(r.race_number), name: String(r.name || '').replace(/\s+(Ms|Ss)$/i, ''), startTime: r.start_time || null, starters: r.starters ?? null }));
    const missing: string[] = [];
    if (!races.length) missing.push('No races yet: fields usually appear once the barrier draw is done.');
    return { ...base, races, available: [`${races.length} races`, 'Fields, form, prices and silks for each race'], missing };
  }
  const r = (detail.races || []).find((x: any) => Number(x.race_number) === Number(raceNumber));
  if (!r) throw Object.assign(new Error(`${meeting.venue} has no race ${raceNumber}.`), { status: 404 });
  const raw = await api(`/races/${r.id}`);
  const race = normRace(raw);
  const running = race.entries.filter((e) => !e.scratched && !e.emergency);
  const sample = await horseInfo(race.entries[0]?.horseId);
  const available: string[] = [];
  const missing: string[] = [];
  available.push(`${running.length} runners${race.entries.some((e) => e.scratched) ? `, ${race.entries.filter((e) => e.scratched).length} scratched` : ''}${race.entries.some((e) => e.emergency) ? `, ${race.entries.filter((e) => e.emergency).length} emergencies` : ''}`);
  if (running.every((e) => e.driver)) available.push('Drivers and trainers');
  else missing.push('Some drivers not named yet');
  const priced = running.filter((e) => e.win).length;
  if (priced) available.push(`TAB fixed odds for ${priced} of ${running.length}`);
  else missing.push('No TAB fixed odds yet');
  if (running.every((e) => e.silk || e.colours)) available.push('Silks');
  else missing.push('Silks for some runners');
  if (running.some((e) => e.form)) available.push('Form figures and TAB comments');
  if (sample?.colour || sample?.sex) available.push('Horse colour and sex (TAB horse records)');
  if (!running.some((e) => e.barrier)) missing.push(`Barriers: TAB does not give them for ${race.start === 'mobile' ? 'mobile starts' : 'this race'} (the gate column will be blank)`);
  missing.push('Ages: TAB gives sex only; type ages on the runner cards if wanted');
  return {
    ...base,
    race: { id: race.id, no: race.no, name: race.name.replace(/\s+(Ms|Ss)$/i, ''), distance: race.distance, start: race.start, stakes: race.stakes, startTime: race.startTime, className: race.className },
    runners: race.entries.map((e) => ({ no: e.no, horse: e.horse, driver: e.driver, odds: e.win, scratched: e.scratched, emergency: e.emergency })),
    available,
    missing,
  };
}

const fail = (ctx: any, e: any) => {
  ctx.status = e?.status && e.status < 600 ? e.status : 502;
  ctx.body = { error: { message: e?.message || 'Racing API error' } };
};

export function registerStoryBuilderRoutes(strapi: Core.Strapi) {
  const can = (ctx: any, action: 'read' | 'create') =>
    !strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model: ARTICLE }).cannot[action]();
  const config = { policies: ['admin::isAuthenticatedAdmin'] };

  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        method: 'GET',
        path: '/hl-story-builder/templates',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'read')) return ctx.forbidden();
          ctx.body = { categories: CATEGORIES, templates: TEMPLATES };
        },
      },
      // Horses by name (the racing API's search), for the horse spotlight.
      {
        method: 'GET',
        path: '/hl-story-builder/horses',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'read')) return ctx.forbidden();
          const q = String(ctx.query.q || '').trim();
          if (q.length < 2) return (ctx.body = []);
          try {
            ctx.body = await searchHorses(q);
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
      // What the racing API has for a race or meeting, before creating anything.
      {
        method: 'POST',
        path: '/hl-story-builder/check',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'read')) return ctx.forbidden();
          const b = ctx.request.body || {};
          const t = TEMPLATES.find((x) => x.id === b.template);
          if (!t || t.needs === 'none') return ctx.badRequest('Unknown template');
          try {
            if (t.needs === 'results') {
              const w = await meetingWrap(Number(b.meetingId));
              ctx.body = { kind: 'results', ...w.summary, available: [`${w.summary.resulted} of ${w.summary.races} races resulted`, 'Winners, placegetters, margins, times and dividends'], missing: w.summary.resulted < w.summary.races ? ['Some races have no result yet'] : [], source: 'TAB, via the HarnessLink racing API', checkedAt: new Date().toISOString() };
              return;
            }
            if (t.needs === 'horse') {
              const h = await horseSpotlight(Number(b.horseId));
              ctx.body = { kind: 'horse', ...h.summary, available: ['Breeding and colour', 'Career record', `${h.summary.runs} runs on record`], missing: h.summary.runs ? [] : ['No runs in the racing data yet'], source: 'TAB horse record, via the HarnessLink racing API', checkedAt: new Date().toISOString() };
              return;
            }
            if (t.needs === 'week') {
              const w = await weekCheck(mondayOf(String(b.week)), String(b.country || 'all'));
              ctx.body = { kind: 'week', ...w, available: [`${w.meetings} resulted meetings`, `${w.races} races`, 'Winners per meeting (fetched when you create the draft)'], missing: w.meetings ? [] : ['No resulted meetings that week'], source: 'TAB results, via the HarnessLink racing API', checkedAt: new Date().toISOString() };
              return;
            }
            ctx.body = await summary({ tabLink: b.tabLink || undefined, meetingId: b.meetingId ? Number(b.meetingId) : undefined, raceNumber: b.raceNumber ? Number(b.raceNumber) : undefined }, t.needs);
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
      // Create the draft with the template's sections, filled by the existing code.
      {
        method: 'POST',
        path: '/hl-story-builder/stories',
        config,
        handler: async (ctx: any) => {
          if (!can(ctx, 'create')) return ctx.forbidden();
          const b = ctx.request.body || {};
          const t = TEMPLATES.find((x) => x.id === b.template);
          if (!t || t.status !== 'live') return ctx.badRequest('That template is not available yet');
          try {
            if (t.needs === 'results' || t.needs === 'horse' || t.needs === 'week') {
              const built =
                t.needs === 'results'
                  ? await meetingWrap(Number(b.meetingId))
                  : t.needs === 'horse'
                    ? await horseSpotlight(Number(b.horseId))
                    : await weeklyReview(mondayOf(String(b.week)), String(b.country || 'all'));
              const title = String(b.title || '').trim() || built.title;
              const doc: any = await strapi.documents(ARTICLE as any).create({
                data: { title, slug: await freeSlug(strapi, slugify(title), 'articles'), bodyFormat: 'legacy_html', bodyHtml: built.html },
              } as any);
              ctx.body = { documentId: doc.documentId, editor: `/content-manager/collection-types/${ARTICLE}/${doc.documentId}` };
              return;
            }
            if (t.id === 'meeting-preview') {
              const { meeting } = await meetingFor({ tabLink: b.tabLink, meetingId: b.meetingId });
              const { documentId } = await createAnalysisStory(strapi, Number(meeting.id), {});
              ctx.body = { documentId, editor: `/race-analysis/${documentId}` };
              return;
            }
            const check = await summary({ tabLink: b.tabLink || undefined, meetingId: b.meetingId ? Number(b.meetingId) : undefined, raceNumber: b.raceNumber ? Number(b.raceNumber) : undefined }, 'race');
            const race = (check as any).race;
            const where = { venue: check.meeting.venue, raceDate: check.meeting.date, raceNumber: race.no, tabLink: b.tabLink || null };
            const claude = !!b.claude;
            const day = new Date(`${check.meeting.date}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
            const titles: Record<string, string> = {
              'race-map': `Race map: ${race.name}`,
              'runner-guide': `${race.name}: the case for and against every runner`,
              'feature-race-preview': `${race.name} preview`,
            };
            const title = String(b.title || '').trim() || titles[t.id];
            const data: Record<string, any> = {
              title,
              slug: await freeSlug(strapi, slugify(`${title} ${day}`), 'articles'),
              bodyFormat: 'legacy_html',
              bodyHtml: '',
            };
            if (t.components.includes('raceMap')) data.raceMap = { ...where, draftWithClaude: claude, runners: [] };
            if (t.components.includes('runnerGuide')) data.runnerGuide = { ...where, addWholeField: true, draftWithClaude: claude, cards: [] };
            const doc: any = await strapi.documents(ARTICLE as any).create({ data } as any);
            ctx.body = { documentId: doc.documentId, editor: `/content-manager/collection-types/${ARTICLE}/${doc.documentId}` };
          } catch (e) {
            fail(ctx, e);
          }
        },
      },
    ],
  } as any);
}
