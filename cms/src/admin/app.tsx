import type { StrapiApp } from '@strapi/strapi/admin';
import { Clock } from '@strapi/icons';

export default {
  config: {
    locales: [],
  },
  register(app: StrapiApp) {
    // Home screen: alongside Strapi's "Last edited" and "Last published",
    // the stories still waiting to go out — drafts and unpublished edits.
    // Journalists can't publish, so for editors this is the review queue.
    app.widgets.register({
      id: 'stories-waiting',
      icon: Clock,
      title: { id: 'harnesslink.widget.waiting.title', defaultMessage: 'Stories waiting to be published' },
      component: async () => (await import('./StoriesWaitingWidget')).default,
      permissions: [{ action: 'plugin::content-manager.explorer.read', subject: 'api::article.article' }],
    });
  },
  bootstrap() {},
};
