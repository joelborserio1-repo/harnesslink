import type { Core } from '@strapi/strapi';

// The menus the site starts with — today's header and footer. Seeded once
// (only when the menu doesn't exist yet), then edited under Navigation in the
// admin. Links are site paths ("/directory/") or full URLs; a flag code shows
// that country's flag beside the item.
type Seed = { title: string; url?: string; flag?: string; items?: Seed[] };

const RACING: Array<[label: string, name: string, flag: string, fields: string, results: string, calendar?: string]> = [
  ['AUS', 'Australia', 'au', 'https://www.harness.org.au/racing/fields', 'https://www.harness.org.au/racing/results/?event=resultsIndex&search_type=daily', '/feature-race-calendar-au/'],
  ['NZ', 'New Zealand', 'nz', 'https://infohorse.hrnz.co.nz/datahrs/fields/fields.htm', 'https://infohorse.hrnz.co.nz/datahrs/results/results.htm', '/feature-race-calendar-nz/'],
  ['USA', 'United States', 'us', 'https://racing.ustrotting.com/', 'https://racing.ustrotting.com/', '/united-states-race-calendar/'],
  ['CA', 'Canada', 'ca', 'https://standardbredcanada.ca/racing?active_tab=entries', 'https://standardbredcanada.ca/racing?active_tab=results', '/canada-race-calendar/'],
  ['Sweden', 'Sweden', 'se', 'https://www.swedishhorseracing.com/races#/calendar', 'https://www.swedishhorseracing.com/races#/calendar'],
  ['France', 'France', 'fr', 'https://www.letrot.com/courses/aujourd-hui', 'https://www.letrot.com/courses/hier'],
];

const MAIN: Seed[] = [
  { title: 'Home', url: '/' },
  {
    title: 'News',
    items: [
      { title: 'AUS', url: '/country/australia/', flag: 'au' },
      { title: 'NZ', url: '/country/new-zealand/', flag: 'nz' },
      { title: 'USA', url: '/country/usa/', flag: 'us' },
      { title: 'CA', url: '/country/canada/', flag: 'ca' },
      { title: 'Europe', url: '/country/europe/', flag: 'eu' },
    ],
  },
  {
    title: 'Racing',
    items: [
      { title: 'International Race Calendar', url: '/international-race-calendar/' },
      ...RACING.map(([label, name, flag, fields, results, calendar]) => ({
        title: label,
        flag,
        items: [
          { title: 'Fields', url: fields },
          { title: 'Results & Replays', url: results },
          ...(calendar ? [{ title: `${name} Race Calendar`, url: calendar }] : []),
        ],
      })),
    ],
  },
  { title: 'The Insider', url: '/the-insider/' },
  { title: 'Contact Us', url: '/contact-us/' },
  { title: 'Directory', url: '/directory/' },
  { title: 'Login', url: '/subscribe/' },
];

const FOOTER: Seed[] = [
  { title: 'Subscribe', url: '/subscribe/' },
  { title: 'Contact', url: '/contact-us/' },
  { title: 'Directory', url: '/directory/' },
];

export const MENUS: Array<{ name: string; slug: string; items: Seed[] }> = [
  { name: 'Main menu', slug: 'main-menu', items: MAIN },
  { name: 'Footer menu', slug: 'footer-menu', items: FOOTER },
];

const key = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function seedMenus(strapi: Core.Strapi) {
  const navs = strapi.documents('plugin::navigation.navigation');
  const items = strapi.documents('plugin::navigation.navigation-item');

  for (const menu of MENUS) {
    const existing = await navs.findFirst({ filters: { slug: menu.slug } });
    if (existing) continue;
    const nav = await navs.create({ data: { name: menu.name, slug: menu.slug, visible: true } as never });

    const add = async (seeds: Seed[], parent: string | null, prefix: string) => {
      for (const [order, s] of seeds.entries()) {
        const uiRouterKey = `${prefix}${key(s.title)}`;
        const item = await items.create({
          data: {
            title: s.title,
            type: s.url ? 'EXTERNAL' : 'WRAPPER',
            externalPath: s.url ?? null,
            path: s.url ? null : uiRouterKey,
            uiRouterKey,
            menuAttached: true,
            order: order + 1,
            collapsed: false,
            master: nav.documentId,
            parent,
            additionalFields: s.flag ? { flag: s.flag } : {},
          } as never,
        });
        if (s.items) await add(s.items, item.documentId, `${uiRouterKey}-`);
      }
    };
    await add(menu.items, null, '');
    strapi.log.info(`[menus] created "${menu.name}"`);
  }
}
