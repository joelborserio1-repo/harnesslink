import type { Core } from '@strapi/strapi';

// Scheduled publishing on Strapi's built-in cron (Strapi's own Releases
// scheduler is a paid feature). An editor fills in "Scheduled for" on a draft;
// within a minute of that time it is published.
export default {
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
