import type { StrapiApp } from '@strapi/strapi/admin';
import { ChartPie, Clock, Discuss, Feather, Monitor, PresentationChart, Calendar } from '@strapi/icons';
import { lightTheme } from '@strapi/design-system';
import mark from './extensions/hl-mark.svg';

// HarnessLink newsroom dashboard on the CMS home screen (widgets in ./widgets, data from
// src/dashboard.ts). Traffic, social, advertising and site checks are for admins and editors;
// newsroom and racing are for everyone, guest authors included.
const EDITORS = ['strapi-super-admin', 'strapi-editor'];
const widgets = () => import('./widgets');

// HarnessLink look: light for everyone (the dark slot gets the same light theme, so a computer in
// dark mode still sees light), with the site's navy as the primary colour.
const harnesslink = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary100: '#EEF2FA',
    primary200: '#C9D4EC',
    primary500: '#3D5A9E',
    primary600: '#00205E',
    primary700: '#001645',
    buttonPrimary500: '#1A3A7A',
    buttonPrimary600: '#00205E',
  },
};

export default {
  config: {
    locales: [],
    theme: { light: harnesslink, dark: harnesslink },
    auth: { logo: mark },
    menu: { logo: mark },
    tutorials: false,
    notifications: { releases: false },
    translations: {
      en: {
        'app.components.LeftMenu.navbrand.title': 'HarnessLink',
        'app.components.LeftMenu.navbrand.workplace': 'Newsroom',
        'Auth.form.welcome.title': 'HarnessLink newsroom',
        'Auth.form.welcome.subtitle': 'Sign in to your account',
      },
    },
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
        // The stories themselves — drafts and unpublished edits, each linking
        // to the editor. Journalists can't publish, so for editors this is
        // the review queue.
        id: 'hl-waiting',
        icon: Clock,
        title: { id: 'hl.dashboard.waiting', defaultMessage: 'Stories waiting to be published' },
        component: async () => (await import('./StoriesWaitingWidget')).default,
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
