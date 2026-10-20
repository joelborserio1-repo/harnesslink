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
- **Blocks editor** — new stories. Migrated stories keep their WordPress HTML in *Migrated story HTML* (`bodyFormat: legacy_html`) and are never converted.
- **Media library** — lead photos and ad creatives for new content. Migrated photos stay on the WordPress uploads until media moves (BUILD_V1 Step 6).
- **Users & Permissions (Public role)** — the site reads articles, writers, sections, tags, pages and the country nav without a token. Ads, subscribers, redirects and the 404 log are never listed publicly.
- **Cron** — scheduled publishing: leave a story as a draft, fill *Schedule for*, and it publishes within a minute of that time.

## Not used (paid in Strapi)

Content History (revisions), Releases (Strapi's own scheduler), Review Workflows, Live Preview, SSO, Audit Logs. Scheduling is covered by the cron task above; the others are not available on Community.

## Custom routes (all public, all narrow)

| Route | Purpose |
|---|---|
| `GET /api/ads/live` | One weighted pick per placement; rails return three different ads |
| `GET /api/ads/:documentId/click` | Count, then 302 to the advertiser |
| `POST /api/ads/:documentId/impression` | Count a viewable impression |
| `POST /api/articles/:slug/view` | View counter (browser beacon) |
| `GET /api/redirects/resolve?path=` | Old URL → new, counts hits (called by the site on every request) |
| `POST /api/missed-paths/log` | The site's 404 page reports misses here |
| `POST /api/subscribers/signup` | Newsletter / registration-wall signup |
| `GET /api/sitemap/articles`, `/api/sitemap/archives` | Lean slug + date listings for the sitemaps |

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
