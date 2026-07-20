// The "Racing" mega-menu — each country links out to its official harness
// authority's Fields and Results pages. AUS is confirmed (harness.org.au); the
// others use each authority's site and should be confirmed / deep-linked.
export type RacingCountry = {
  code: string;
  name: string;
  flag: string; // emoji flag
  fields: string;
  results: string;
};

export const RACING: RacingCountry[] = [
  {
    code: "AUS",
    name: "Australia",
    flag: "🇦🇺",
    fields: "https://www.harness.org.au/racing/fields",
    results: "https://www.harness.org.au/racing/results/?event=resultsIndex&search_type=daily",
  },
  {
    code: "NZ",
    name: "New Zealand",
    flag: "🇳🇿",
    fields: "https://www.hrnz.co.nz/",
    results: "https://www.hrnz.co.nz/",
  },
  {
    code: "USA",
    name: "USA",
    flag: "🇺🇸",
    fields: "https://www.ustrotting.com/",
    results: "https://www.ustrotting.com/",
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    fields: "https://standardbredcanada.ca/",
    results: "https://standardbredcanada.ca/",
  },
  {
    code: "SWE",
    name: "Sweden",
    flag: "🇸🇪",
    fields: "https://www.travsport.se/",
    results: "https://www.travsport.se/",
  },
  {
    code: "FRA",
    name: "France",
    flag: "🇫🇷",
    fields: "https://www.letrot.com/",
    results: "https://www.letrot.com/",
  },
];
