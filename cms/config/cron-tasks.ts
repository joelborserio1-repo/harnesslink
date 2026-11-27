import type { Core } from '@strapi/strapi';
import { buildRoundups, processWaiting } from '../src/email-processor';
import { sendRecap } from '../src/story-stats';

// Scheduled publishing on Strapi's built-in cron (Strapi's own Releases
// scheduler is a paid feature). An editor fills in "Scheduled for" on a draft;
// within a minute of that time it is published.
export default {
  // Emailed stories still waiting (CMS restarted, Claude busy, key added
  // later): every 5 minutes. src/email-processor.ts.
  processEmailedStories: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await processWaiting(strapi);
    },
    options: { rule: '*/5 * * * *' },
  },
  // Minor emailed news → one News Briefs draft per region, Wednesdays 6am Sydney time.
  buildEmailRoundups: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await buildRoundups(strapi);
    },
    options: { rule: '0 6 * * 3', tz: 'Australia/Sydney' },
  },
  // Story performance recaps to STATS_RECAP_TO (src/story-stats.ts): yesterday
  // at 7am NZ every day, and the past week on Monday mornings.
  dailyStoryRecap: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await sendRecap(strapi, 'day');
    },
    options: { rule: '0 7 * * *', tz: 'Pacific/Auckland' },
  },
  weeklyStoryRecap: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await sendRecap(strapi, 'week');
    },
    options: { rule: '15 7 * * 1', tz: 'Pacific/Auckland' },
  },
  // The daily form guide (src/form-guide.ts): a card for every AU/NZ meeting
  // at 7am NZ, and again at 11am for meetings the TAB adds later in the morning.
  dailyFormGuide: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      const { buildDailyFormGuide } = await import('../src/form-guide');
      await buildDailyFormGuide(strapi);
    },
    options: { rule: '0 7,11 * * *', tz: 'Pacific/Auckland' },
  },
  publishScheduledArticles: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      const uid = 'api::article.article';
      const due = await strapi.documents(uid).findMany({
        status: 'draft',
        filters: { scheduledFor: { $notNull: true, $lte: new Date().toISOString() } },
        fields: ['documentId', 'publishDate', 'scheduledFor', 'title'],
        limit: 50,
      });
      for (const doc of due) {
        // null clears the field; the generated input types don't allow it.
        const data = { scheduledFor: null, publishDate: doc.publishDate ?? doc.scheduledFor };
        await strapi.documents(uid).update({ documentId: doc.documentId, data: data as never });
        await strapi.documents(uid).publish({ documentId: doc.documentId });
        strapi.log.info(`[schedule] published "${doc.title}"`);
      }
    },
    options: { rule: '* * * * *' },
  },
  // TAB prices on event pages (The Eureka…): 8am and 4pm Sydney time, as the
  // old WordPress plugin did. See src/api/event-page/services/odds.ts.
  refreshEventOdds: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await (strapi.service('api::event-page.odds') as any).refreshAll();
    },
    options: { rule: '0 8,16 * * *', tz: 'Australia/Sydney' },
  },
  // The Insider: copy new editions from the Mailchimp archive.
  copyInsiderEditions: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      await (strapi.service('api::insider-edition.sync') as any).run();
    },
    options: { rule: '15 */6 * * *', tz: 'Pacific/Auckland' },
  },
};
