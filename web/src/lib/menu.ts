import { COUNTRIES, countryHref } from "@/lib/countries";
import { RACING } from "@/lib/racing";

// Header and footer menus, edited in Strapi under Navigation ("Main menu",
// "Footer menu"). If Strapi can't be reached the site falls back to the
// menus below, which match what Strapi was seeded with.
export type MenuItem = {
  title: string;
  href: string | null; // null = a heading that only opens its sub-menu
  external: boolean; // another site: opens in a new tab
  flag: string | null;
  items: MenuItem[];
};

const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");
// Full links to our own site (as editors may paste them) become site paths.
const OWN_HOSTS = /^https?:\/\/(www\.|staging\.)?harnesslink\.com(?=\/|$)/i;

type NavItem = {
  title: string;
  type: "INTERNAL" | "EXTERNAL" | "WRAPPER";
  path?: string | null;
  externalPath?: string | null;
  menuAttached?: boolean;
  related?: { slug?: string; path?: string; __contentType?: string } | null;
  additionalFields?: { flag?: string } | null;
  items?: NavItem[];
};

// Where an INTERNAL item (linked to a section, page, writer or story) lives.
function relatedHref(r: NonNullable<NavItem["related"]>): string | null {
  const type = (r.__contentType || "").toLowerCase();
  if (type.includes("category") && r.slug) return `/category/${r.slug}/`;
  if (type.includes("author") && r.slug) return `/writers/${r.slug}/`;
  if (type.includes("page") && r.path) return r.path.endsWith("/") ? r.path : `${r.path}/`;
  if (r.slug) return `/${r.slug}/`;
  return null;
}

// Menu items saved in Strapi before our own racing pages existed still point at
// HRA / HRNZ. Send those to our pages instead.
const OWN_RACING: [RegExp, string][] = [
  [/^https?:\/\/(www\.)?harness\.org\.au\/racing\/fields/i, "/racing/au/fields/"],
  [/^https?:\/\/(www\.)?harness\.org\.au\/racing\/results/i, "/racing/au/results/"],
  [/^https?:\/\/infohorse\.hrnz\.co\.nz\/datahrs\/fields/i, "/racing/nz/fields/"],
  [/^https?:\/\/infohorse\.hrnz\.co\.nz\/datahrs\/results/i, "/racing/nz/results/"],
];

function toItem(n: NavItem): MenuItem {
  let href: string | null = null;
  if (n.type === "EXTERNAL") href = n.externalPath || n.path || null;
  else if (n.type === "INTERNAL") href = n.related ? relatedHref(n.related) : null;
  if (href && OWN_HOSTS.test(href)) href = href.replace(OWN_HOSTS, "") || "/";
  const own = href ? OWN_RACING.find(([re]) => re.test(href!)) : undefined;
  if (own) href = own[1];
  return {
    title: n.title,
    href,
    external: !!href && /^https?:/i.test(href),
    flag: n.additionalFields?.flag || null,
    items: (n.items || []).filter((i) => i.menuAttached !== false).map(toItem),
  };
}

export async function getMenu(slug: "main-menu" | "footer-menu"): Promise<MenuItem[]> {
  try {
    const res = await fetch(`${STRAPI_URL}/api/navigation/render/${slug}?type=TREE`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = (await res.json()) as NavItem[];
      if (Array.isArray(data) && data.length) return data.filter((i) => i.menuAttached !== false).map(toItem);
    }
  } catch {
    // fall back below
  }
  return slug === "main-menu" ? DEFAULT_MAIN : DEFAULT_FOOTER;
}

const link = (title: string, href: string, flag: string | null = null): MenuItem => ({
  title,
  href,
  external: /^https?:/i.test(href),
  flag,
  items: [],
});
const heading = (title: string, items: MenuItem[], flag: string | null = null): MenuItem => ({
  title,
  href: null,
  external: false,
  flag,
  items,
});

const DEFAULT_MAIN: MenuItem[] = [
  link("Home", "/"),
  heading("News", COUNTRIES.map((c) => link(c.code, countryHref(c.slug), c.flag))),
  heading("Racing", [
    link("International Race Calendar", "/international-race-calendar/"),
    ...RACING.map((c) =>
      heading(
        c.label,
        [
          link("Fields", c.fields),
          link("Results & Replays", c.results),
          ...(c.calendar ? [link(`${c.name} Race Calendar`, c.calendar)] : []),
        ],
        c.flag
      )
    ),
  ]),
  link("The Insider", "/the-insider/"),
  link("Contact Us", "/contact-us/"),
  link("Directory", "/directory/"),
  link("Login", "/subscribe/"),
];

const DEFAULT_FOOTER: MenuItem[] = [
  link("Subscribe", "/subscribe/"),
  link("Contact", "/contact-us/"),
  link("Directory", "/directory/"),
];
