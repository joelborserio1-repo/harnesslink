import type { StrapiApp } from '@strapi/strapi/admin';
import { ChartPie, Discuss, Feather, Monitor, PresentationChart, Calendar } from '@strapi/icons';

// HarnessLink newsroom dashboard on the CMS home screen (widgets in ./widgets, data from
// src/dashboard.ts). Traffic, social, advertising and site checks are for admins and editors;
// newsroom and racing are for everyone, guest authors included.
const EDITORS = ['strapi-super-admin', 'strapi-editor'];
const widgets = () => import('./widgets');

export default {
  config: {
    locales: [],
  },
  register(app: StrapiApp) {
    app.widgets.register([
      {
        id: 'hl-newsroom',
        icon: Feather,
        title: { id: 'hl.dashboard.newsroom', defaultMessage: 'Newsroom' },
        component: async () => (await widgets()).NewsroomWidget,
      },
      {
        id: 'hl-traffic',
        icon: ChartPie,
        title: { id: 'hl.dashboard.traffic', defaultMessage: 'Traffic' },
        component: async () => (await widgets()).TrafficWidget,
        roles: EDITORS,
      },
      {
        id: 'hl-social',
        icon: Discuss,
        title: { id: 'hl.dashboard.social', defaultMessage: 'Social' },
        component: async () => (await widgets()).SocialWidget,
        roles: EDITORS,
      },
      {
        id: 'hl-advertising',
        icon: PresentationChart,
        title: { id: 'hl.dashboard.advertising', defaultMessage: 'Advertising' },
        link: { label: { id: 'hl.dashboard.advertising.link', defaultMessage: 'All ads' }, href: '/content-manager/collection-types/api::ad.ad' },
        component: async () => (await widgets()).AdvertisingWidget,
        roles: EDITORS,
      },
      {
        id: 'hl-racing',
        icon: Calendar,
        title: { id: 'hl.dashboard.racing', defaultMessage: 'Racing today' },
        component: async () => (await widgets()).RacingWidget,
      },
      {
        id: 'hl-sites',
        icon: Monitor,
        title: { id: 'hl.dashboard.sites', defaultMessage: 'Sites' },
        component: async () => (await widgets()).SitesWidget,
        roles: EDITORS,
      },
    ]);
  },
};
