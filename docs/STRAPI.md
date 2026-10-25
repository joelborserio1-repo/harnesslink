# Harnesslink on Strapi — how it fits together

**Decided 20 Oct 2026** by the owner: the back end is Strapi 5 (self-hosted,
Community edition), using its built-in features wherever they exist. The
Next.js public site (`web/`) keeps its design and reads everything from
Strapi. The Rails API (`api/`) remains only for the directory until that moves
across; nothing new is built in Rails.

```
WordPress ──export_posts.php──▶ cms/scripts/import-wordpress.js ──▶ Strapi (cms/) ──REST──▶ Next.js site (web/)
 (read-only)                                                        Postgres db harnesslink_cms
```

## Where things live

| | |
|---|---|
| Content model | `cms/src/api/*/content-types/*/schema.json`, components in `cms/src/components/shared/` |
| Custom routes (things Strapi doesn't do) | `cms/src/api/*/routes/0*-*.ts` + matching `controllers/` |
| Permissions, editor layouts | `cms/src/index.ts`, `cms/src/admin-layouts.ts` |
| Scheduled publishing | `cms/config/cron-tasks.ts` |
| WordPress import | `cms/scripts/import-wordpress.js`, `cms/scripts/wordpress-mapper.js` |
| Site ↔ CMS | `web/src/lib/api.ts` (reads), `web/src/lib/blocks.ts` (Blocks → HTML), `web/src/lib/sitemaps.ts` |

## Built-in Strapi features used

- **Content-type builder / content manager** — every type is defined as code, so changes are reviewed in git. The newsroom layout (labels, help text, field order, newest-first lists) is applied from `src/admin-layouts.ts`; bump `LAYOUT_VERSION` to re-apply after changing it.
- **Draft & Publish** — articles and pages.
- **Admin roles** — journalists get the built-in **Author** role (create and edit their own stories; publishing is removed for Author at startup), editors get **Editor**, the desk lead **Super Admin**. Invite people under *Settings → Administration panel → Users*.
- **Story editor** — CKEditor 5 (community plugin `@_sh/strapi-plugin-ckeditor`, bundled, no licence key) on the *Story* field (`bodyHtml`, `bodyFormat: legacy_html`). New and migrated stories use the same editor; migrated HTML is untouched unless someone edits and saves the story (scripts are stripped on save). The old Blocks field stays for the one test story that used it. Pasted YouTube/Vimeo links are saved as `<oembed>` and turned into players by the site.
- **Preview** — the Preview button opens the saved draft on the website (Next draft mode), with Draft/Published tabs and a mobile view. Needs `SITE_URL` and `PREVIEW_SECRET` in both cms and web. Drafts come from `GET /api/preview/:collection` (secret header only).
- **Home screen** — Strapi's *Last edited* / *Last published* plus our *Stories waiting to be published* (`src/admin/StoriesWaitingWidget.tsx`).
- **WordPress habits** (`src/index.ts`) — a new story gets the writer whose profile email matches the signed-in admin as its byline; an empty standfirst is filled from the first paragraph.
- **Media library** — lead photos and ad creatives for new content. Migrated photos stay on the WordPress uploads until media moves (BUILD_V1 Step 6).
- **Users & Permissions (Public role)** — the site reads articles, writers, sections, tags, pages and the country nav without a token. Ads, subscribers, redirects and the 404 log are never listed publicly.
- **Cron** — still runs the older *Schedule for* field for any story that has it set; new scheduling uses Publisher (below).
- **Document Service middleware** — a story published for the first time gets that moment as its *Publish date* (`src/index.ts`).

## Marketplace plugins (config in `config/plugins.ts`)

- **Navigation** (VirtusLab) — the header menu ("Main menu") and footer quick links ("Footer menu"). Items can be nested three deep (Racing → AUS → Fields) and carry a **Flag** (au, nz, us, ca, eu, gb, se, fr). Seeded once from `src/menus.ts`; after that the admin is the source. The site falls back to the same menus if Strapi is unreachable.
- **Publisher** (PluginPal) — *Add a publish date* / *unpublish date* in the right-hand panel of a story or page.
- **Comments** (VirtusLab) — reader comments under each story. Every comment waits for approval (*Comments → Discover*); readers' emails are never returned by the public API. Bad-word filter on.
- **oEmbed** — the story's *Video or social embed* field: paste a YouTube/Vimeo/X/Instagram/Facebook link; the player shows under the story.
- **Meilisearch** — site search. Indexes headline, standfirst, excerpt, byline, section and date (not story text); typo-tolerant, newest first among equals. Kept in sync as stories are published; rebuild with `node scripts/index-search.js`. Off when `MEILI_HOST` is unset (the site then falls back to a plain database search).

The Navigation and Comments plugins read their settings from the database, not the config file, so `src/plugin-settings.ts` copies the file settings in at startup when the saved ones are missing (comment approval and hidden emails depend on this). Later changes on their Settings pages are kept.

## Ads: placement, dates, countries

*Start date* / *Finish date* bound when an ad runs. The **Show in …** ticks (Australia, New Zealand, USA, Canada, UK & Ireland, Europe, everywhere else) limit it to readers in those countries; none ticked = everywhere. The reader's country comes from Cloudflare's `CF-IPCountry` header, so the site must be proxied through Cloudflare (orange cloud) for targeting to work — without it every reader counts as "everywhere else". Add `?geo=NZ` to any page to preview what a reader in another country sees.

## Not used (paid in Strapi)

Content History (revisions), Releases (Strapi's own scheduler), Review Workflows, Live Preview, SSO, Audit Logs. Scheduling is covered by the Publisher plugin; the others are not available on Community.

## Custom routes (all public, all narrow)

| Route | Purpose |
|---|---|
| `GET /api/ads/live?country=AU` | One weighted pick per placement, only ads that run in that country; rails return three different ads |
| `GET /api/ads/:documentId/click` | Count, then 302 to the advertiser |
| `POST /api/ads/:documentId/impression` | Count a viewable impression |
| `POST /api/articles/:slug/view` | View counter (browser beacon) |
| `GET /api/redirects/resolve?path=` | Old URL → new, counts hits (called by the site on every request) |
| `POST /api/missed-paths/log` | The site's 404 page reports misses here |
| `POST /api/subscribers/signup` | Newsletter / registration-wall signup |
| `GET /api/sitemap/articles`, `/api/sitemap/archives` | Lean slug + date listings for the sitemaps |
| `GET /api/preview/target`, `/api/preview/:collection` | Drafts for the Preview button (needs the `x-preview-secret` header) |

**Drafts are never public.** Strapi would otherwise return drafts to anyone adding `?status=draft`; `src/middlewares/published-only.ts` refuses that unless the request carries an API token.

The 404 log (*Missed path*) is hidden from the admin menu so it doesn't flood the home screen; read it with SQL or re-enable it in its schema.

The site reaches these through its own paths (`/ad/:id/click/`, `/track/view/:slug/`, `/api/subscribe/`), rewritten in `web/next.config.ts`.

## Importing from WordPress

```bash
# On the WordPress server (read-only):
EXPORT_LIMIT=5000 EXPORT_PAGE=1 wp eval-file migration/export_posts.php --path=/var/www/harnesslink.com/ > posts-1.json   # 2, 3, … until a page has < 5000
EXPORT_LIMIT=0 EXPORT_TYPES=page wp eval-file migration/export_posts.php --path=/var/www/harnesslink.com/ > pages.json

# Into Strapi (locally: from cms/; in Docker: docker compose exec cms …):
CRON_ENABLED=false node scripts/import-wordpress.js posts-*.json
CRON_ENABLED=false node scripts/import-wordpress.js --pages pages.json
```

The export renders each body the way WordPress core does (paragraphs, captions,
embeds) without plugin filters, resolves Molongui bylines, and includes
WordPress's own auto-summary. The import is idempotent and skips unchanged
stories; `--force` re-imports everything. Six spam posts with emoji slugs are
skipped (Strapi slugs can't hold them) and listed at the end of the run.

## Running locally

```bash
cd cms && cp .env.example .env   # fill in secrets: openssl rand -base64 32
npm run develop                  # admin at http://localhost:1337/admin
cd ../web && STRAPI_URL=http://127.0.0.1:1337 npm run dev
```

## Staging

`https://staging.harnesslink.com/cms/admin` — Strapi in Docker (`cms` service),
proxied by nginx at `/cms/`. Its secrets are in `cms/.env` on the server (not in
git). See `DEPLOY.md`.
