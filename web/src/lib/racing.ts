import type { FlagCode } from "@/components/Flag";

// The "Racing" menu, as on the live site: each country links out to its
// racing authority's Fields and Results & Replays, plus our own race
// calendar where we publish one.
export type RacingCountry = {
  label: string; // as shown in the menu (AUS, NZ, USA…)
  name: string; // full name, for calendar link text
  flag: FlagCode;
  fields: string;
  results: string;
  calendar?: string;
};

export const RACING: RacingCountry[] = [
  {
    label: "AUS",
    name: "Australia",
    flag: "au",
    fields: "https://www.harness.org.au/racing/fields",
    results: "https://www.harness.org.au/racing/results/?event=resultsIndex&search_type=daily",
    calendar: "/feature-race-calendar-au/",
  },
  {
    label: "NZ",
    name: "New Zealand",
    flag: "nz",
    fields: "https://infohorse.hrnz.co.nz/datahrs/fields/fields.htm",
    results: "https://infohorse.hrnz.co.nz/datahrs/results/results.htm",
    calendar: "/feature-race-calendar-nz/",
  },
  {
    label: "USA",
    name: "United States",
    flag: "us",
    fields: "https://racing.ustrotting.com/",
    results: "https://racing.ustrotting.com/",
    calendar: "/united-states-race-calendar/",
  },
  {
    label: "CA",
    name: "Canada",
    flag: "ca",
    fields: "https://standardbredcanada.ca/racing?active_tab=entries",
    results: "https://standardbredcanada.ca/racing?active_tab=results",
    calendar: "/canada-race-calendar/",
  },
  {
    label: "Sweden",
    name: "Sweden",
    flag: "se",
    fields: "https://www.swedishhorseracing.com/races#/calendar",
    results: "https://www.swedishhorseracing.com/races#/calendar",
  },
  {
    label: "France",
    name: "France",
    flag: "fr",
    fields: "https://www.letrot.com/courses/aujourd-hui",
    results: "https://www.letrot.com/courses/hier",
  },
];
