# Harnesslink v1 — Claude Code Build Prompt

**How to use this:** Don't paste the whole thing at once. Paste **Step 0** to establish context, let Claude Code read and confirm, then work through steps one at a time. Each step has acceptance criteria — do not advance until they pass. The whole document should live in your repo as `BUILD_V1.md` so Claude Code can re-read it.

---

## Step 0 — Context and constraints (paste this first)

```
I'm rebuilding Harnesslink, a harness racing news publication, off WordPress.
You'll be building this with me over multiple sessions. Read this whole brief and
confirm your understanding before writing any code.

## What exists today
- WordPress + Elementor + JNews theme, ~60 plugins
- ~100,000 published articles dating back years
- ~200,000 media assets
- Established organic search rankings and Google News presence
- Contributors: Adam Hamilton, Tony Milanese, Bruce Stewart, Trent Orwin, and others
- Categories are geographic: Australia, New Zealand, USA, Canada, Europe, UK/IRE,
  plus editorial ones like "Top 4"
- Rank Math handles SEO; its metadata lives in wp_postmeta

## Target stack — free and open source only
- Ruby on Rails 8, Postgres 16, Sidekiq, Redis          (all free)
- Next.js 15 App Router + React 19 + Tailwind, self-hosted   (free)
- Postgres full-text search — NO separate search server in v1   (free)
- MinIO or local volume for media in dev; object storage in prod
- imgproxy for image resizing                           (open source)
- Kamal 2 for deploys                                   (free)
- Cloudflare free tier for CDN
- GlitchTip for error tracking                          (open source, Sentry-compatible)
- Do not introduce any paid SaaS dependency without asking me first.

## THE OVERRIDING CONSTRAINT: SEO must not regress

This is not a preference. It is the acceptance criterion for the entire project.
Harnesslink's traffic is its business. A 20% organic decline is a failed project
regardless of how good the code is.

Concretely, this means:

1. **URL preservation is the highest priority.** Every existing article URL must
   resolve at the SAME path on the new site. Not via redirect — the same path.
   Redirects are a fallback for URLs we genuinely cannot preserve, not a strategy.
   Before designing routing, inspect the real WordPress permalink structure.

2. **Rendered content must be byte-comparable where possible.** Do not
   "improve" or normalise legacy article HTML. Sanitise for security, rewrite
   asset URLs, and otherwise leave it alone.

3. **All Rank Math metadata must migrate**: rank_math_title,
   rank_math_description, rank_math_focus_keyword, rank_math_canonical_url,
   rank_math_robots, and OG/Twitter overrides.

4. **Structured data must be present on every article**: schema.org NewsArticle
   with headline, datePublished, dateModified, author, publisher, image.

5. **Sitemaps**: standard XML sitemap index (paginated, 100k URLs won't fit in
   one file) AND a Google News sitemap covering the last 48 hours.

6. **Preserve**: publish dates, modified dates, author attribution, category and
   tag archive URLs, pagination patterns, RSS feed URLs, canonical tags,
   H1 text, and internal link targets.

7. **Core Web Vitals should IMPROVE.** This is the one dimension where we expect
   to gain. Target LCP < 2.0s, CLS < 0.1, INP < 200ms on 4G.

## Critical architecture decision — read carefully

Legacy articles store their body as **sanitised HTML**, exactly as WordPress
rendered it. New articles authored in our CMS store body as **TipTap JSON**.

The Article model has a `body_format` enum (`legacy_html` | `tiptap_json`) and
the renderer branches on it.

Do NOT propose converting 100k legacy articles to structured JSON. That
conversion is the single largest risk to SEO parity in this project, and the
upside doesn't justify it. If you think this is wrong, say so now and argue it,
but do not quietly implement a converter later.

## Rules of engagement

- Propose your approach and STOP before implementing anything that touches
  routing, slugs, metadata, or the importer. I approve, then you build.
- Never write to a production database. Read-only credentials in all tooling.
- Ask before adding any dependency.
- Prefer boring and well-documented over clever.
- Write tests as you go, not at the end. Every model, every request path.
- When uncertain about WordPress data structure, inspect real fixtures rather
  than assuming. Assumptions about WordPress content are how migrations fail.

## What v1 is NOT
Out of scope for v1, to be built later: ad serving, paywall/Stripe, newsletter,
comments, the Directory section, reader accounts. Design so these can be added,
but build none of them now.

Confirm you've read this, then summarise back to me: the stack, the SEO
constraint, and the body_format decision. Then wait.
```

---

## Step 1 — Reconnaissance (no code)

```
Before we build anything, I need to know exactly what we're migrating.

Write a read-only Ruby script `migration/recon.rb` that connects to a READ-ONLY
copy of the WordPress database and reports:

1. Exact permalink structure — inspect wp_options for 'permalink_structure' and
   sample 50 real post URLs to confirm the pattern
2. Post counts by post_type, post_status, and by year
3. All distinct post_type values (there may be custom types we don't know about)
4. Category and tag taxonomy: full tree with counts and slugs
5. All distinct author IDs with display names and post counts — flag any
   near-duplicate names that are probably the same person
6. wp_postmeta: all distinct meta_key values with frequency, so we know what
   Rank Math and other plugins have stored
7. Media: total count, total size, distinct MIME types, and how many are
   referenced in post content vs orphaned
8. Any posts with duplicate slugs
9. Comment counts by status
10. Date range of published content

Output a markdown report to `migration/RECON.md`.

Do not write any migration code yet. This report tells us what the schema
needs to accommodate.
```

**Acceptance:** RECON.md exists, and you personally read it looking for surprises. Custom post types and unexpected `meta_key` values are the two things that most often blow up scope.

---

## Step 2 — Content pattern catalogue (no code)

```
Export 500 representative published posts as JSON into `migration/fixtures/` —
stratified across every year of publication, every category, and every author,
so we see the full range of editor eras (classic HTML, Gutenberg, Elementor).

Then analyse them and produce `migration/CONTENT_PATTERNS.md` cataloguing:

- Every distinct shortcode, with frequency and an example
- Every Gutenberg block type present
- Every Elementor-generated wrapper or markup pattern
- Every embed type (YouTube, X, Instagram, Facebook, iframes, oEmbed)
- Inline image markup variants and how srcset/sizes are expressed
- Gallery structures
- Any malformed or unclosed HTML
- Character encoding anomalies
- Internal link patterns — how articles link to each other

For each pattern: frequency, an example, proposed handling, and a risk rating
for whether our handling could alter rendered output.

This document is the spec for the importer. Be thorough — a pattern you miss
here becomes thousands of broken articles later.
```

**Acceptance:** Every pattern has a proposed handling. Anything rated high-risk gets discussed with you before the importer is written.

---

## Step 3 — Rails foundation and schema

```
Set up the Rails 8 API application in `api/`.

- Postgres 16, Sidekiq, Redis, Kamal 2 config, GitHub Actions CI running
  RuboCop (rails-omakase) and Minitest
- Active Storage configured for MinIO locally

Then propose (don't implement yet) the schema for:

Article, Author, Category, Tag, Country, MediaAsset, Redirect, ArticleRevision,
User (admin accounts, separate from Author)

Requirements informed by RECON.md:
- Article has `body_format` enum (legacy_html | tiptap_json), `body_html`,
  `body_json`
- Article has `legacy_wp_id` and `legacy_url`, both uniquely indexed, never null
  for migrated content
- Article has a full SEO field set mirroring what Rank Math stored
- Slugs must accommodate the real WordPress permalink structure found in Step 1
- Status enum: draft | in_review | scheduled | published | archived
- Index every column we'll filter or sort on — we have 100k rows and cannot
  afford sequential scans
- Add a `published_at` descending index and a composite index for
  category + published_at

Show me the schema and your reasoning. I'll approve before you write migrations.
```

**Acceptance:** Schema approved by you. Migrations run clean up and down. Model tests pass.

---

## Step 4 — Routing and the SEO parity harness

```
This step protects the whole project. Build it before the importer.

1. Implement routing in Rails and Next.js that reproduces the EXACT WordPress
   permalink structure identified in Step 1, for articles, category archives,
   author archives, tag archives, pagination, and feeds.

2. Build a Redirect model and middleware: a lookup on incoming path, 301 to
   the target, increment a hit counter. Unmatched paths hit a logged 404
   handler that records the path so we can fix real misses from real traffic.

3. Build `migration/seo_parity.rb` — a verification harness that, given a list
   of URLs, fetches both the live WordPress site and our new site and diffs:
   - HTTP status
   - <title>
   - meta description
   - canonical URL
   - H1 text
   - Open Graph tags
   - JSON-LD structured data presence and type
   - word count of main content (flag >5% deviation)
   - count of internal links
   - count of images

   Output a report with a pass/fail per URL and a summary.

This harness is our definition of done. Every subsequent step is verified
against it. Make it easy to run against 100, 1,000, or all URLs.
```

**Acceptance:** Harness runs and produces a report. It will fail everything right now — that's correct, we have no content yet. The harness working is the deliverable.

---

## Step 5 — The importer

```
Build the WordPress importer in `migration/`, driven by CONTENT_PATTERNS.md.

Requirements:
- Resumable and checkpointed. It WILL fail partway through 100k records.
  Track progress in a table; support restart from last checkpoint.
- Idempotent. Running twice must not duplicate or corrupt.
- Batched through Sidekiq, with configurable concurrency.
- Additive only — never deletes or overwrites existing records.
- For each article: sanitise body HTML (allowlist, not denylist), rewrite media
  URLs to our new paths, preserve everything else verbatim.
- Set body_format to legacy_html for everything imported.
- Migrate all Rank Math metadata into our SEO fields.
- Map authors, categories, tags, countries.
- Record legacy_wp_id and legacy_url on every article.
- Generate Redirect records for any URL that cannot be served at its
  original path — and log loudly, because that should be rare.
- Structured logging so we can audit what happened to any given post.

Then write tests that run the importer against migration/fixtures/ and assert
output correctness for each content pattern in the catalogue.

Do not run this against the full dataset yet.
```

**Acceptance:** Full test suite green against fixtures. Import 1,000 real articles into staging, run the SEO parity harness against those 1,000 URLs, and get a clean report before proceeding.

---

## Step 6 — Media migration

```
Build the media migration.

- Download all media from WordPress, preserving original files
- Store originals immutably; never overwrite
- Generate responsive variants via imgproxy (WebP and AVIF with fallbacks)
- Preserve alt text, captions, and credits from wp_postmeta
- Record legacy_url on every asset so in-body URL rewriting can resolve
- Resumable and idempotent, same as the article importer
- Report on: assets that failed to download, assets referenced in content but
  missing, and orphaned assets

Serve images through Cloudflare with long cache headers and correct
Content-Type. Images must have explicit width and height attributes in markup
to prevent layout shift — CLS is part of our SEO constraint.
```

**Acceptance:** Sample of 500 articles renders with all images present. Lighthouse CLS under 0.1 on article pages.

---

## Step 7 — Editorial admin

```
Build the editorial interface. This is what Adam and the team use daily — if
it's worse than WordPress, the migration fails on adoption rather than tech.

- React admin served by Rails, or a separate authenticated Next.js route
- TipTap editor producing tiptap_json for new articles
- Legacy articles open in a raw HTML editing mode — do NOT load legacy HTML
  into TipTap, it will mangle it
- Autosave every ~10 seconds, with full revision history and restore
- Drag-and-drop image upload; alt text is a required field
- oEmbed resolution: paste a YouTube or X URL, get a typed embed node
- Scheduled publishing with correct timezone handling — we publish across
  AU, NZ, and US
- Shareable preview links for unpublished drafts
- SEO panel showing the title/description as they'd appear in search, with
  length warnings
- Roles: contributor (own drafts), editor (publish anything), admin
- Usable on a phone — contributors file from trackside

Free/open-source only. No commercial admin frameworks.
```

**Acceptance:** Adam writes and publishes a real article start to finish without assistance. Get him to actually do it and watch.

---

## Step 8 — Public site

```
Build the Next.js public site in `web/`.

- Header and footer rebuilt to match the current live site pixel-for-pixel.
  Match the DESIGN, not the Elementor DOM. Nav structure data-driven from the API.
- Templates: article, category archive, author archive, country archive,
  tag archive, homepage, search results
- Static generation with ISR — articles pre-rendered, revalidated on edit
- Every template ships with: full metadata, canonical, OG/Twitter tags,
  NewsArticle JSON-LD, correct heading hierarchy
- Sitemap index, paginated sitemaps, and a Google News sitemap (last 48h)
- RSS feeds at the existing feed URLs
- Search via Postgres full-text with pg_trgm for fuzzy matching. No search
  server in v1.
- Playwright visual regression tests against reference screenshots of the
  current live site, at mobile, tablet, and desktop breakpoints
- Lighthouse CI in the pipeline, failing the build if Performance or SEO
  scores drop below thresholds we set from the current site's baseline

Capture the current site's Lighthouse scores FIRST and use them as the floor.
```

**Acceptance:** Lighthouse SEO 100, Performance meaningfully above the current site. Visual regression tests pass. SEO parity harness passes on 1,000 sampled URLs.

---

## Step 9 — Full dry run

```
Run the complete migration end to end on staging.

Then:
1. Crawl the live WordPress site fully; produce a definitive URL inventory
2. Crawl staging; produce the same
3. Diff them. Every URL in the old set must be present or deliberately
   redirected. Report anything unaccounted for.
4. Run the SEO parity harness across the FULL URL set, not a sample
5. Produce a report of every failure, categorised by cause

Do this three times, fixing between runs, until the report is clean.
```

**Acceptance:** Clean crawl diff. SEO parity harness passes at >99.5%, and you have personally reviewed every failure in the remaining 0.5%.

---

## Step 10 — Pre-cutover checklist

```
Produce a cutover runbook covering:
- Google Search Console baseline capture (coverage, impressions, average
  position, top 1,000 queries) recorded BEFORE cutover
- Final content sync procedure for articles published during the freeze window
- DNS change steps with TTL lowered 48h in advance
- Rollback procedure — must be a DNS change, not a database restore
- Post-cutover monitoring: what to watch, at what interval, for how long
- Sitemap resubmission steps
- A go/no-go checklist with named owners

Then write `POST_CUTOVER_MONITORING.md`: daily SEO checks for the first 30 days,
with the specific thresholds that would trigger a rollback decision.
```

**Acceptance:** You'd be comfortable executing this at 6am on a Sunday.

---

## Things to deliberately keep out of Claude Code's hands

- The DNS cutover itself
- Final sign-off on "does this article look right" — automated diffs catch structural breakage, not a pull quote landing in the wrong place. A human reads a sample.
- The go/no-go decision

---

## Open questions still blocking a complete v1

These don't stop you starting, but answer them before Step 3:

1. What is the actual permalink structure? (Step 1 will tell you, but you may already know.)
2. Are there custom post types beyond `post` and `page`?
3. Does anything on the site depend on user login today, beyond commenting?
4. What's your current Lighthouse score and Core Web Vitals status? That's the floor you must beat.
5. Where will v1 be hosted, and do you have a staging environment?
