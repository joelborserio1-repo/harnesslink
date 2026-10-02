// The "Explore by Countries" nav — the geographic sections we surface across
// the site (header menu, country switcher, footer). On the live site each
// country has its own archive at /country/{slug}/ (a separate `country`
// taxonomy, self-canonical) and that is what the navigation links to; the
// matching /category/{slug}/ archive also exists and keeps working. Order here
// is the display order.
export type Country = {
  code: string; // short label used in the compact nav (AUS, NZ, USA, CA, EUROPE)
  name: string; // full region name used in headings
  slug: string; // shared by /country/{slug}/ and /category/{slug}/
};

export const COUNTRIES: Country[] = [
  { code: "AUS", name: "Australia", slug: "australia" },
  { code: "NZ", name: "New Zealand", slug: "new-zealand" },
  { code: "USA", name: "USA", slug: "usa" },
  { code: "CA", name: "Canada", slug: "canada" },
  { code: "EUROPE", name: "Europe", slug: "europe" },
];

// The footer's list on the live site also carries UK / IRE.
export const FOOTER_COUNTRIES: Country[] = [
  COUNTRIES[0],
  COUNTRIES[2],
  COUNTRIES[3],
  COUNTRIES[4],
  COUNTRIES[1],
  { code: "UK/IRE", name: "UK / IRE", slug: "uk-ire" },
];

export const COUNTRY_SLUGS = FOOTER_COUNTRIES.map((c) => c.slug);

export function countryHref(slug: string): string {
  return `/country/${slug}/`;
}

export function isCountrySlug(slug: string): boolean {
  return COUNTRY_SLUGS.includes(slug);
}
