# Harnesslink Cutover Runbook

**Purpose:** move `harnesslink.com` from WordPress to the Rails + Next.js stack
**without losing SEO.** This is the operational checklist for the DNS cutover.
BUILD_V1 Step 10. Precedence rules in `docs/README.md` still apply.

> The overriding acceptance criterion is unchanged: **every existing article
> URL resolves at the SAME path** (`/%postname%/`), and Rank Math
> metadata + `NewsArticle` JSON-LD ship on every page. If that is not true on
> staging, do not cut over.

**Ground truth (from `migration/DISCOVERED_FACTS.md`):** 62,558 published
articles, ~132k media assets, permalink `/%postname%/`, WP table prefix
`wzev_`. Live production WordPress is **read-only** to us — never write to it.

---

## 0. Roles (fill in real names before the window)

| Role | Owner | Responsible for |
| --- | --- | --- |
| **Cutover lead** (go/no-go) | _TBD_ | Calls the shot; owns this runbook |
| DNS / infra | _TBD_ | TTL lowering, the A/CNAME change, rollback |
| Backend / data | _TBD_ | Final content sync, import verification |
| SEO / analytics | _TBD_ | GSC baseline, sitemap resubmission, monitoring |
| Editorial | _TBD_ | Freeze coordination, human sample review |

No single step is "done" until its owner says so in the shared cutover channel.

---

## 1. Pre-cutover gates (must all be green — do NOT proceed otherwise)

Run from a machine with network access to **both** live and staging (your Mac
or the server — the CI box is network-restricted).

1. **Crawl diff clean.** Every live URL present or deliberately redirected.
   ```
   ruby migration/crawl_diff.rb \
     --live https://harnesslink.com \
     --new  https://staging.harnesslink.com
   ```
   Acceptance: `Unaccounted (FAIL): 0`. Review every entry in the
   "deliberately redirected" table — each must be intended.

2. **SEO parity >99.5% across the FULL URL set** (not a sample). The crawl
   diff writes `migration/live_urls.txt`; feed it straight in:
   ```
   ruby migration/seo_parity.rb \
     --live https://harnesslink.com \
     --new  https://staging.harnesslink.com \
     --paths migration/live_urls.txt
   ```
   Acceptance: pass rate >99.5%, and the cutover lead has **personally read
   every failure** in the remaining <0.5% and signed them off as acceptable.

3. **Redirects loaded.** Legacy `old_slugs` → current slug redirects are in the
   `redirects` table and the Rack middleware serves 301s. Spot-check 10 known
   renamed slugs.

4. **Sitemaps + feeds resolve on staging** at the public paths:
   `/sitemap.xml`, `/sitemap-articles-N.xml`, `/news-sitemap.xml`,
   `/archives-sitemap.xml`, `/feed/`, `/robots.txt`. `robots.txt` must point at
   `https://harnesslink.com/sitemap.xml` (the production host, not staging).

5. **Human sample review.** Editorial reads ~30 articles across types (legacy
   HTML, shortcode-heavy, gallery, embedded video, tables) on staging. Automated
   diffs catch structural breakage; a human catches a pull quote in the wrong
   place. This is explicitly **not** Claude's call.

6. **Core Web Vitals ≥ the WordPress floor.** Record staging Lighthouse
   (mobile) for the homepage, a category, and 3 articles. New scores must meet
   or beat the WordPress numbers captured in step 2 below. See the open
   question in BUILD_V1 — if the WP floor was never captured, capture it now
   from live before cutover.

7. **Rollback rehearsed.** You have the current WordPress DNS records saved
   (see §6) and have confirmed you can revert them.

---

## 2. Google Search Console baseline (capture BEFORE cutover)

This is the "before" photo. Without it you cannot prove the migration was
SEO-neutral, and you cannot set rollback thresholds. Capture and archive to
`migration/gsc_baseline/` (CSV exports + a dated screenshot of each):

- **Coverage / Pages report:** count of Indexed pages; note the number and top
  reasons for Excluded/Not-indexed.
- **Performance (last 3 months, and last 28 days separately):**
  - Total clicks, total impressions, average CTR, average position.
  - Export **top 1,000 queries** (query, clicks, impressions, CTR, position).
  - Export **top 1,000 pages** by clicks.
- **Sitemaps report:** which sitemaps are currently submitted and their status.
- **Manual actions / Security:** confirm none outstanding.

Record the capture date/time and the GSC property type (domain vs URL-prefix).
These CSVs are the reference set the 30-day monitoring plan diffs against.

---

## 3. Freeze + final content sync

WordPress keeps publishing until the freeze. Plan for a short freeze window and
a delta import so nothing published during it is lost.

1. **T-24h:** notify editorial of the freeze start time. After freeze, **no new
   posts or edits** in WordPress until cutover completes (or rollback).
2. **Freeze begins.** Record the exact timestamp `T_freeze`.
3. **Delta import.** Re-run the export limited to content modified since the
   last full import, then the importer (idempotent — `find_or_initialize_by
   legacy_wp_id`, so re-running is safe):
   ```
   # on the WP host (read-only DB creds):
   wp eval-file api/migration/export_posts.php --after="<last_import_iso8601>" > delta.json
   # on the app host:
   RAILS_ENV=production bin/rails runner 'Wordpress::Importer.new(source: Wordpress::JsonSource.new("delta.json")).run'
   ```
4. **Verify counts.** Published article count on new ≥ live published count at
   `T_freeze`. No `legacy_wp_id` gaps. Re-run the §1.1 crawl diff — still clean.
5. **Re-run parity** on the newly-synced URLs (§1.2). Still >99.5%.

If the delta import surfaces failures you can't clear quickly: **hold**. A clean
freeze that runs 30 extra minutes beats a cutover that drops content.

---

## 4. DNS change

1. **T-48h:** lower TTL on the `harnesslink.com` A/ALIAS (and `www` CNAME)
   records to **300s (5 min)**. Confirm the low TTL has propagated (it must have
   been live longer than the *old* TTL) before proceeding. This is what makes a
   fast rollback possible.
2. **Cutover moment:** point the apex + `www` at the new stack's ingress
   (load balancer / server IP). Keep the record type consistent with today's
   setup; do not switch apex A↔ALIAS during the window if avoidable.
3. **Force HTTPS + canonical host.** New stack must:
   - serve valid TLS for `harnesslink.com` **and** `www` (cert issued and
     stapled *before* the DNS flip),
   - 301 `www` → apex (or whichever is canonical today — match live),
   - 301 `http` → `https`.
4. **Watch propagation** with the low TTL. Verify from multiple resolvers.

Do **not** raise the TTL again until §7 monitoring is green for 48h.

---

## 5. Immediately after the flip (first 60 minutes)

Owner: SEO/analytics + backend, in the cutover channel.

1. `curl -sI https://harnesslink.com/` → 200, correct `server`/app headers.
2. Spot-check 10 article URLs, 3 categories, 2 author archives, 2 tag archives
   → all 200 at the same path, correct canonical + `NewsArticle` JSON-LD.
3. Hit 5 known **redirected** slugs → 301 to the right target.
4. `https://harnesslink.com/sitemap.xml` and `/news-sitemap.xml` → 200, correct
   `<loc>` host is production.
5. `https://harnesslink.com/robots.txt` → 200, references the production
   sitemap, does **not** `Disallow: /`.
6. Confirm analytics is recording pageviews on the new stack.
7. Confirm error rate / 5xx on the app is flat (app logs, `MissedPath` 404 log).

If any of 1–5 fail and can't be fixed in minutes → **rollback (§6).**

---

## 6. Rollback (a DNS change — NEVER a database restore)

Production WordPress was never written to, so it is still a valid, current site
(minus anything published during the freeze). Rollback is simply pointing DNS
back.

1. Revert the apex + `www` records to the **saved** WordPress values (captured
   in §1.7; keep them pinned at the top of the cutover channel).
2. With TTL at 300s, propagation is ~5 min. Verify `curl -sI` returns the
   WordPress stack.
3. Lift the editorial freeze on WordPress.
4. Post-mortem before re-attempting: the delta import (§3) means any content
   published on the new stack during the brief live window must be reconciled
   back — but during a freeze there should be none.

**Rollback trigger conditions (any one):** widespread non-200s on article URLs;
canonical/JSON-LD missing at scale; redirects returning 404; TLS failure on the
production host; analytics/GSC showing a cliff (see `POST_CUTOVER_MONITORING.md`
thresholds).

---

## 7. Sitemap resubmission + indexing nudge (after flip is stable)

1. In GSC, **resubmit** `sitemap.xml` (index) and `news-sitemap.xml`. Remove any
   stale WordPress/Yoast/Rank Math sitemap entries no longer served.
2. Use **URL Inspection → Request indexing** on the homepage and ~10 top pages
   (from the §2 top-pages export) to prime recrawl. Don't bulk-spam it.
3. Confirm `robots.txt` sitemap directive points at the production sitemap.
4. If Bing Webmaster Tools is used, resubmit there too.

---

## 8. Go / No-Go checklist

Cutover lead reads this aloud; each owner answers **GO** or **NO-GO**.

- [ ] Crawl diff: 0 unaccounted (backend) — **GO / NO-GO**
- [ ] SEO parity >99.5%, sub-0.5% failures personally reviewed (lead) — **GO / NO-GO**
- [ ] Redirects verified (backend) — **GO / NO-GO**
- [ ] Sitemaps/feeds/robots correct on staging (SEO) — **GO / NO-GO**
- [ ] Human sample review passed (editorial) — **GO / NO-GO**
- [ ] Core Web Vitals ≥ WordPress floor (SEO) — **GO / NO-GO**
- [ ] GSC baseline captured + archived (SEO) — **GO / NO-GO**
- [ ] Final content sync done, counts reconciled (backend) — **GO / NO-GO**
- [ ] TTL lowered ≥48h ago and propagated (DNS) — **GO / NO-GO**
- [ ] TLS valid for apex + www on new stack (DNS/infra) — **GO / NO-GO**
- [ ] Rollback DNS values saved + revert rehearsed (DNS) — **GO / NO-GO**
- [ ] Monitoring dashboards + on-call ready (SEO) — **GO / NO-GO**

**All GO → cut over. Any NO-GO → hold.** After the flip, follow
`POST_CUTOVER_MONITORING.md` for 30 days.

---

## Explicitly out of scope for automation (human-owned)

- The DNS cutover trigger itself.
- Final "does this article *look* right" sign-off (the §1.5 sample review).
- The go/no-go decision.
