# Harnesslink — platform assessment and plugin rebuild spec

**Written:** 2 October 2026, against the live site and the repo at `a67b1e5` plus
that day's working changes. Updated the same day after sign-off on the Rails
stack, the URL fixes and per-person staff logins (marked DONE below). Reference doc (precedence 3 in `docs/README.md`);
`BUILD_V1.md` still governs.

---

## 1. Recommendation: stay on Rails, do not move to Strapi

Strapi would replace the one part of this build that is generic (a content
admin) and none of the parts that are specific to Harnesslink.

| Need | Strapi (self-hosted) | Current Rails + Next build |
|---|---|---|
| Article authoring UI | Good out of the box | Built (TipTap editor, SEO panel, bylines) — rougher than Strapi's |
| Roles | Custom admin roles are free | `User` roles exist; login is not wired (see §3) |
| Revision history | Paid: Growth plan, 14-day retention | `article_revisions` table already in the schema |
| Scheduled publishing | Paid: Releases are Growth and up | `scheduled` status in the schema; needs the job |
| Review workflow (contributor → editor) | Enterprise only | `in_review` status in the schema; needs the UI |
| 62,558 legacy articles as verbatim HTML | Possible, but its rich-text field wants Markdown/Blocks — legacy HTML would sit in a plain text field | Designed for it (`body_format`) |
| WordPress importer | Would be rewritten in Node | Written and tested |
| Ad serving, advertiser billing, Xero | Custom code either way | Custom code either way; ad serving already exists |
| Directory, race calendar, Eureka page, reader wall | Custom code either way | Directory, calendar and wall already exist |
| URL / SEO parity | Decided by the Next.js front end, not the CMS | Same |

Strapi's self-hosted pricing (checked 2 Oct 2026): Community free; Growth US$45/month
for 3 seats plus US$15 per extra seat; Enterprise by quote. The three features a
newsroom leans on — history, scheduling, review — are all on paid tiers, and
`BUILD_V1.md` rules out paid dependencies without sign-off.

Switching would discard 57 commits and 115 passing backend tests to gain a
nicer editing screen. The cheaper fix for "not happy with the admin" is to
finish the journalist portal on the stack that already holds the data (§3).

**When Strapi would be the right call:** if the plan changed to "content site
only" — no ad system, no billing, no directory — and nobody would maintain
custom code. That is not this project.

---

## 2. Where each requirement stands

| Area | State today | What is missing |
|---|---|---|
| Public site templates | Rebuilt 2 Oct in the new flat editorial design; legal pages migrated | The Eureka page, podcasts, contributors, reader login |
| WordPress migration | Importer (articles + static pages), redirects, parity and crawl-diff harnesses built; never run on the full set | Full dry run (BUILD_V1 Step 9); verify the byline export (§5.5) |
| Author backend | Next.js `/admin` (stories, bylines, categories, SEO, TipTap) and Avo at `/avo` | Avo still has its own Devise login |
| Journo portal | Per-person sign-in; journalists file and submit, editors review and publish; revisions captured | Autosave, revision restore screen, scheduled publishing job, image upload |
| User management | `/admin/users` — create, re-role, reset password, deactivate; roles enforced in the API | Self-service password reset by email |
| Ad management | Zones, weighted rotation, date windows, click and impression counts, admin CRUD | §4.4 — advertisers, targeting, daily stats |
| Advertiser billing + Xero | Nothing | §3 |
| Reader registration wall | Client-side metered wall + signup | Magic-link login for returning readers |
| Social auto-post | Webhook fired on publish | §4.5 |

---

## 3. The journalist portal (built) and advertiser billing (awaiting answers)

### Journalist portal — DONE (first version)

Built 2 Oct 2026. Staff are `User` rows with a password and a role; the shared
`ADMIN_USER` / `ADMIN_PASSWORD` gate is gone.

- Journalist (`contributor`): sees only their own stories, files drafts, sends
  them to "Awaiting review". Cannot publish, and cannot edit a story once the
  desk has published it. A journalist linked to a byline gets it automatically.
- Editor: review queue, publishes, edits anything, manages the directory.
- Admin: all of that plus ads and staff accounts.
- Each edit keeps the previous version in `article_revisions`.

Still to do: autosave, a screen to browse and restore revisions, the job that
publishes `scheduled` stories at their time, drag-and-drop images with required
alt text, password reset by email, and moving Avo onto the same login.

### Advertiser billing with Xero

Proposal for the data model (additive migrations):
- `advertisers` — company, contacts, Xero ContactID.
- `bookings` — advertiser, placement (zone or directory listing), start/end,
  rate and billing period.
- `ads` gain `advertiser_id` and `booking_id`; daily `ad_stats` rows replace the
  two running totals so a booking can be reported on by date range.
- `invoices` — one per booking period, with the Xero InvoiceID and status.

Flow: a booking generates draft invoices → pushed to Xero through the
Accounting API (OAuth 2, `xero-ruby` gem — **new dependency, needs sign-off**)
→ a Xero webhook marks them paid or overdue → an overdue booking can pause its
ads. Directory "paying" listings bill through the same tables.

Needed from the business: the Xero organisation and a Xero app's credentials;
how advertisers are charged today (flat monthly per position, packages, or
impression-based); GST treatment per country; whether overdue accounts should
auto-pause.

---

## 4. Plugin rebuild spec

Supplied 2 Oct 2026. These are to be re-implemented, not ported. The two
Harnesslink-authored data sets (race calendar rows, directory CSV) are reused
as data; no plugin code is copied.

### 4.1 Feature Race Calendar (v4.0.7, plus the earlier "polished" v2.2.1) — REBUILT

WordPress: shortcode `[harnesslink_race_calendar country="AU|NZ|ALL|US|CA|INTL"]`;
327 AU, 208 NZ and 777 North American rows; filters for jurisdiction, gait,
grade, month and text; table and summary views; mini-calendar; upcoming Group 1
list; purses in local currency; USTA source and last-updated note.

Rebuilt as `web/src/components/RaceCalendar.tsx` + `web/src/lib/raceCalendar.ts`
at the live URLs: `/international-race-calendar/`, `/feature-race-calendar-au/`,
`/feature-race-calendar-nz/`, `/united-states-race-calendar/`,
`/canada-race-calendar/`. Filtering is server-side from the query string, so it
ships no JavaScript and every filtered view is a linkable page.

Not yet carried over: the mini month-grid, the summary view, the USTA
source/last-updated line. Next step: move the rows into Postgres with an admin
screen so the calendar can be edited without a deploy.

### 4.2 Harnesslink Directory (v1.7.6) — PARTLY REBUILT, now behind

The Rails port (`DirectoryListing`, `DirectoryProgeny`, CSV import, public
pages) was made from plugin v1.6.1. Since then the plugin added, in v1.7.x:
- redesigned horse profile: hero image, gallery, videos (YouTube, Vimeo, upload);
- pedigree — up to 14 ancestors each with a race record, plus a paste-in
  "quick fill";
- "Crosses of Gold" repeatable table;
- related horses;
- member login (register, login, reset, honeypot) with contact details shown
  to logged-in members only.

These need porting. The member login should be the same reader account as the
registration wall, not a second system.

### 4.3 Partnership Pages / "Harnesslink Eureka Page" (v2.9.5) — NOT BUILT

A `partnership_page` type with switchable modules, currently used once, for
`/the-eureka/`: countdown, event facts, about, news (posts in the Eureka
category), slot holders and assigned runners, TAB futures odds (a manually
updated snapshot), reader poll (one vote per browser, optional live results),
previous winners with replay links, partners and associates logos, newsletter
signup, Instagram feed (Meta OAuth, hashtags, cached), advertising slot.

Rebuild as a `PartnershipPage` record whose sections are structured JSON edited
in the admin, rendered by one Next.js template, so the next sponsored event is
a new record rather than a new build. Instagram needs a Meta app and review.
The homepage Eureka panel currently links to `/category/eureka/` as a stand-in.

### 4.4 Advanced Ads (v2.0.26) and Advanced Ads Pro (v3.0.14) — PARTLY REBUILT

34 ads live on WordPress. Already covered: placements (zones), weighted
rotation, start and end dates, image or HTML creatives, click and viewable
impression counting, CLS-safe reserved slots.

Still to build, in rough priority:
1. Advertiser → booking → creative structure and per-day stats (needed for
   billing and for advertiser reports).
2. Geo targeting by reader country. Many current creatives are market-specific
   ("available in New Zealand and Australia").
3. In-content placement (after paragraph N of an article).
4. Device targeting and separate mobile creatives.
5. Day-of-week and hour-of-day scheduling.
6. Click-fraud guard and frequency capping.
7. Lazy loading, ad-block fallback, `ads.txt`.
8. Placement A/B tests.

Not needed unless asked for: background and parallax ads, grids, bbPress,
BuddyPress, GamiPress and Paid Memberships integrations, AdSense helpers.

### 4.5 Blog2Social (v9.1.3) — MINIMAL REPLACEMENT EXISTS

Today: `SocialPublishJob` posts to one webhook when a story is first published.

To match how Blog2Social is actually used, confirm which networks are connected
on the live site, then build: per-network post templates, a per-story override
before publishing, a schedule or queue, re-sharing of older stories, and a log
of what was posted where. Posting directly to Meta, X and LinkedIn each needs a
developer app and review; routing through a paid posting service is faster but
is a paid dependency that needs sign-off.

---

## 5. Findings from the live site that change the migration

Found while loading 300 current stories into the local preview.

1. **Country pages live at `/country/{slug}/`** as well as `/category/{slug}/`
   (separate taxonomy, each self-canonical; the nav links `/country/`).
   DONE — both resolve, navigation uses `/country/`, both are in the sitemap.
2. **Author archives live at `/writers/{slug}/`**, and `/author/{slug}/` 301s
   there. DONE — same behaviour in the new build.
3. **Static pages.** 76 WordPress pages exist. DONE for the content pages
   (`privacy-policy`, `disclaimers`, `terms-conditions`,
   `a-pilgrimage-to-france`) via the new `Page` model and
   `Wordpress::PageImporter`. DONE as native routes: `/contact-us/` (with
   `/contact/` → 301, as live), `/subscribe/`, `/the-insider/editions/`,
   `/the-insider/sign-up/`, the five race calendars. Redirected: `/directory-2/`
   → `/directory/`, `/subscribe-2/`, `/privacy-policy-2/`.
   **Still unserved:** `/the-eureka/`, `/login/` `/register/` `/account/`
   `/password-reset/` (reader accounts), `/contributors/`, `/advertise-with-us/`,
   `/podcasts/`, `/videos/`, `/archives/`, `/articles/`, `/trainers/`, and the
   `/racing/{country}/{fields|results-and-replays|form|race|horse|trainer|driver}/`
   tree (33 pages — what these render needs checking before deciding).
   Test pages to drop: `api-testing`, `ztest-page`, `trotbo-*`, `adupload`.
4. **The site runs on New Zealand time.** Dates printed on the live site are
   `Pacific/Auckland`; the front end formats in that zone.
5. **Bylines come from Molongui Authorship, not the WordPress post author.**
   Nearly every post is owned by one WP user; the plugin swaps in the real
   byline at render time (the 602 `guest_author` posts). `export_posts.php` now
   reads `_molongui_author` / `_molongui_main_author` and resolves guests and
   users, falling back to the WP author. **Verified 2 Oct 2026** on the live
   server (read-only, 21 posts): every exported byline matched the
   `<meta name="author">` on the live page (21/21), bodies arrive in full with
   no paywall markup, and `path` is exported. This answers open question 3
   in `DISCOVERED_FACTS.md`.
6. **The live `NewsArticle` JSON-LD names "Bevan Greig" as author on almost
   every article** (it uses the WP post author). The new build emits the real
   byline. This is a deliberate improvement, but the parity harness will see a
   difference in structured data author.
7. **The paywall wraps content in the REST API.** Only the first three posts of
   any REST response carry a full body. The database export is unaffected, but
   the REST API cannot be used as an import or sync source.
8. **Live articles do not show the featured image above the story**; the photo
   is inside the body. The article template only adds a lead image when the
   body has none, so image counts match for the parity harness.
9. **Page titles differ.** Live archive titles are "Australia – Harnesslink";
   the new build uses "Australia Harness Racing News | Harnesslink". Left as
   built earlier — decide whether titles should match live exactly.

---

## 6. Local preview

`./dev.sh` from the repo root starts Postgres, the API (`:3001`) and the site
(`:3000`). The 300 sample stories were loaded with
`migration/fetch_live_sample.rb` (dev only — see the header of that file). Staff sign in at `/admin`: the
first admin is `ADMIN_EMAIL` with the `ADMIN_PASSWORD` from `.env`; development
also seeds `journo@`, `editor@` and `admin@harnesslink.test` (password in
`DEV_STAFF_PASSWORD`, default in `api/db/seeds.rb`, never created outside
development). Ad images are the three seeded house ads; imgproxy is not configured locally, so
photos load at original size and are slower than they will be in production.
