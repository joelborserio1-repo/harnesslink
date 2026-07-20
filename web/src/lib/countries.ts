// The "Explore by Countries" nav — the geographic sections we surface across
// the site (header strip + region landing pages). These point at category
// archives, so the canonical URL is /category/{slug}/ (the live permalink base
// is preserved; see CUTOVER_RUNBOOK / DISCOVERED_FACTS if that base is ever
// confirmed flat). Order here is the display order.
export type Country = {
  code: string; // short label used in the compact nav (AUS, NZ, USA, CA, EUROPE)
  name: string; // full region name used in headings
  slug: string; // category slug — the archive lives at /category/{slug}/
};

export const COUNTRIES: Country[] = [
  { code: "AUS", name: "Australia", slug: "australia" },
  { code: "NZ", name: "New Zealand", slug: "new-zealand" },
  { code: "USA", name: "USA", slug: "usa" },
  { code: "CA", name: "Canada", slug: "canada" },
  { code: "EUROPE", name: "Europe", slug: "europe" },
];

export const COUNTRY_SLUGS = COUNTRIES.map((c) => c.slug);

export function countryHref(slug: string): string {
  return `/category/${slug}/`;
}

export function isCountrySlug(slug: string): boolean {
  return COUNTRY_SLUGS.includes(slug);
}
