# HarnessLink Newsroom — WordPress Plugin

Internal newsroom intake, triage, and drafting tools for the HarnessLink
editorial team. This plugin never republishes another outlet's article —
it helps editorial staff notice news faster, assembles supporting research,
and drafts house-style stories that a human reviews and publishes.

Built in phases; this document is updated as each phase lands.

---

## Installation

1. Upload the `hl-newsroom/` folder to your WordPress `/wp-content/plugins/` directory.
2. Activate the plugin in **WordPress Admin → Plugins**.
3. Find **HarnessLink Newsroom** in your left admin sidebar.

---

## Current status (v0.2.0 — post-beta hardening pass)

All seven phases are built: bootstrap and Source Registry, all four intake
channels, the triage gate and Story Candidate CPT, style templates and the
story generator, the editorial dashboard with WordPress publish
integration, and the outbound layer (RSS, public API stubs, syndication
stubs, Popular/Insider). v0.2.0 followed with a beta-test hardening pass:
a deterministic Feature Race Calendar → Story Candidate link, the completed
generation-provider integration contract, a generalised append-only audit
log, service-level kill-switch enforcement, fully configurable/explainable
trending scoring, defensive WordPress taxonomy handling, and a Verified
Social admin state that's honest about being unconfigured. See "Complete
plugin structure" below for the full map, and "Beta hardening pass
(v0.2.0)" for what changed and why.

No story has ever gone live on harnesslink.com through this plugin: the
Publish action only ever creates a WordPress post with status `pending`.
The only path from `pending` to live is the normal WordPress editorial
process, outside this plugin entirely.

## Pages

- **Dashboard** — Registry stats overview
- **Sources** — Add, edit, or disable entries in the Source Registry
- **Verified Social (X)** — Add, edit, or disable individually-vetted X accounts on the allow-list
- **Story Candidates** — Standard WP list-table view of every `hln_candidate` post
- **Editorial Dashboard** — Incoming / Recommended / Building / Ready for Review / Changes Required / Published columns, filterable by region, plus the kill-switch panel
- **Review Story** — Single review screen for one candidate (reached from the dashboard, not its own menu item)
- **Style Templates** — Edit the per-story-type templates that drive generation
- **Settings** — Attribution, category taxonomy, premium defaults, email-intake webhook signing key, X API bearer token, and syndication toggles
- **Intake Log** — Raw items from every intake channel (processed / unclassified / quarantined / discarded), filterable by channel, plus the feature race calendar

---

## Settings Reference

| Setting | Description |
|---|---|
| Default Byline | `hln_default_byline` — used on every generated draft unless overridden per-post at review time. Defaults to "HarnessLink Media". Never set to a source's own name. |
| Inbound Webhook Signing Key | `hln_inbound_email_signing_key` — signing key from the inbound-parse email provider (Mailgun payload assumed by default). The `/wp-json/hln/v1/inbound-email` endpoint rejects every request until this is set. |
| X API Bearer Token | `hln_x_api_bearer_token` — used by both the Verified Social (X) poller and the broader trending scan. Neither does anything until this is set. |
| Generation Provider Class | `hln_generation_provider_class` — fully-qualified class name implementing `HLN_Generation_Provider_Interface`, used when the `hln_generation_provider` filter returns nothing. The Settings screen shows live Configured/Available status next to this field. |
| Trending Score Weights | `hln_trending_weights` — every weight, multiplier, and threshold `HLN_Trending` uses (source authority, recency, corroboration, entity significance, historical performance, X signal, breaking-news boost, duplicate demotion factor, Tier 2 threshold, dashboard Recommended threshold). V1 defaults, all admin-editable. |
| Feature Race Calendar Windows | `hln_race_preview_window_days` / `hln_race_result_window_days` — how many days ahead/behind a calendar entry's race date before it becomes a Preview/Result candidate. |
| Regions | `hln_regions` — top-level category list (one per line), matching the live site's region structure. |
| Sub-Categories | `hln_subcategories` — sub-category list (one per line) applied under every region. |
| Premium Defaults by Story Type *(legacy)* | `hln_is_premium_defaults` — **not read by the generator.** The per-template `is_premium_default` on the Style Templates screen is the source of truth. Kept only for backward compatibility with anything still reading this option directly. |

## Source Registry fields

| Field | Description |
|---|---|
| Label | Display name shown throughout the admin |
| Source Type | `official`, `trade-press`, `verified-social`, or `race-data` |
| Region | `usa`, `canada`, `australia`, `new_zealand`, or `europe` |
| URL | Source URL |
| Ingestion Method | `api`, `rss`, `email`, `monitored-page`, or `x-api` |
| Trust Score | 0–100, starting weight for future triage/trending scoring |
| Check Frequency | Poll interval, e.g. `30m`, `1h`, `6h` |
| Auto-Publish | Per-source flag, always defaults to off. Governed by the kill switch (Editorial Dashboard) and the `hln_audit_log` audit trail — nothing publishes without human review regardless of this setting. |
| Governing Body | Set for official/race-data sources |
| Enabled | Disable a source without deleting it |

Sources are seeded from the official governing bodies and trade-press
outlets HarnessLink monitors. Edits made on the Sources screen are stored
separately from the seed list and always take precedence, so the seed list
can be safely updated later without losing admin changes.

## Verified Social (X) allow-list fields

| Field | Description |
|---|---|
| Handle | X username, without the @ sign |
| Owning Entity | The real organisation/person behind the handle |
| Entity Type | `governing_body` \| `trainer` \| `driver` \| `track` \| `media` \| `other` |
| Verification Method | Free-text: how this was confirmed as the genuine, named account — required |
| Verified | Explicit checkbox, distinct from the free-text note above |
| Priority | 1 (highest) – 10 (lowest). Stored and admin-editable; not yet used to order polling or weight scoring — reserved for future prioritisation, not over-engineered in this pass |
| Region | Optional |
| Check Frequency | Poll interval, e.g. `15m` |
| Enabled | Disable an account without removing it |
| Last Poll | Read-only status the poller writes on every attempt: `last_polled_at` + `last_error` (null on success). Shown on the allow-list table so a stalled/failing account is visible, not silently dead. |

Never seeded with placeholder handles — every row must be added by a human
who individually confirmed the account, per spec §2.3. The page itself
states **"No verified social accounts configured"** when the list is
empty, and shows whether the X API bearer token is set, so it's never
ambiguous why nothing is happening. Both `HLN_X_Poller` and
`HLN_Trending_Signal` fail gracefully — record a status, don't throw —
when there are no handles, no credentials, or the X API is unreachable.

---

## Intake channels

| Channel | Class | Detail |
|---|---|---|
| Email | `HLN_Email_Intake` | REST endpoint `POST /wp-json/hln/v1/inbound-email`. Verifies the inbound-parse webhook signature, matches the sender against the Source Registry by domain, and — only on a match — extracts a headline, short excerpt, entities, and PDF attachment text. Unmatched senders are logged as Unclassified and never become a Story Candidate. |
| Race data | `HLN_Race_Data` | Per-source WP-Cron poll at each source's Check Frequency. Uses an API-adapter extension point (`hln_race_data_api_adapter_{slug}` filter) where a governing body has a confirmed API — none do yet in the seeded registry — and a monitored-page fetch + diff job everywhere else. |
| Feature race calendar | `HLN_Race_Data::run_calendar_for_all_jurisdictions()` | Runs across every enabled official-body source, not a single market. Extraction is resolved per source through the `HLN_Race_Calendar_Adapter_Interface` registry (`hln_race_calendar_adapter_{slug}` filter) — a jurisdiction-specific adapter (HRNSW, HRNZ, USTA, etc.) can be added later without changing `HLN_Race_Data`; none exist yet, so every source falls back to `HLN_Generic_Calendar_Adapter`'s best-effort `<table>` reader. |
| Calendar → candidate link | `HLN_Race_Candidate_Link` | Deterministic, not fuzzy: a calendar entry within the Preview Window becomes a Preview candidate, and one whose race date has passed (within the Result Window) becomes a Result candidate — tracked via `preview_candidate_id`/`result_candidate_id` on the calendar row itself, so a given entry can never spawn more than one candidate per type. Racing intelligence attaches automatically via the candidate's `race_calendar_id`. See "Feature Race Calendar → Story Candidate link" below. |
| Stewards reports | `HLN_Stewards_Parser` | Invoked from within the email, race-data, and RSS channels when a document looks like a stewards report. USTA stewards/ruling material is always flagged `requires_source_clearance = true` and quarantined — republishing/rewriting it isn't cleared under USTA's terms. Other jurisdictions record a `confirm_status` field for the same reason, without the hard block. |
| Racing intelligence | `HLN_Racing_Intelligence` | Assembles a structured (non-prose) record per feature-race-calendar entry — archive cross-references for prior results/mentions — for the story generator to draw on starting in Phase 5. Fields with no real data source yet (barrier history, form/speed figures) are left as honest empty arrays rather than fabricated. |
| RSS | `HLN_RSS_Intake` | One poll per source whose Ingestion Method is `rss`, at that source's Check Frequency. Trade-press items are always flagged `verify_against_official` — trade press is colour/quotes/angle only, never unverified fact. |
| Verified Social (X) | `HLN_X_Poller` | Polls only the explicitly vetted allow-list — no keyword/hashtag search. Every candidate is unconditionally flagged `verify_against_official`, regardless of trust or trending. The original post's wording is never reproduced as a quote or excerpt; `body_excerpt` is built from detected entities and a link, not the post's own text. Photo/video media from these posts is always `agency_flagged`. |
| Trending signal | `HLN_Trending_Signal` | A separate, broader X scan — not limited to the allow-list — whose only job is detecting unusual attention on a horse/trainer/race. Structurally incapable of creating a Story Candidate or supplying a fact/quote: it has no dependency on `HLN_Intake_Log` and writes exclusively to its own `hln_trending_signal` table. |

## Database tables

| Table | Purpose |
|---|---|
| `hln_intake_log` | Every raw item from any intake channel, with its processed/unclassified/quarantined/discarded status. Email, race-data, RSS, and X all write to this same table. A `candidate_id` column links a promoted row to its `hln_candidate` post. |
| `hln_race_calendar` | Feature-race-calendar entries per jurisdiction. `preview_candidate_id`/`result_candidate_id` (added v0.2.0) deterministically link an entry to its Story Candidate(s) — see below. |
| `hln_race_intelligence` | Assembled racing-intelligence payload per calendar entry. |
| `hln_monitored_state` | Last-seen watermark (content hash, or a last-seen item id for RSS/X) per polled source, so a poll only surfaces genuinely new content. |
| `hln_trending_signal` | Raw output of the broad X trending scan (term, sample count, detection window). Never touched by any other class. |
| `hln_audit_log` | Append-only event log (Hard Requirement 5) — see "Audit trail" below for the full event vocabulary. `candidate_id` is nullable (system events use `source_slug` instead); `user_id` and `created_at` are captured on every row. |

---

## Triage, Story Candidates & trending (Phase 4)

- **`HLN_Triage`** — WP-Cron job (every 5 minutes) running Stage A (rule-based: headline present, excerpt long enough, has a date, not an exact-URL duplicate) against every processed/quarantined intake-log row. Failures are marked `discarded` on the existing log row and never become a candidate. Rows that pass become a full `hln_candidate` post (Stage B) via `HLN_Candidate_CPT::create_from_intake_row()`. Checks `HLN_Kill_Switch` before promoting — a killed source's rows are left untouched, not discarded, and picked up normally once the switch lifts.
- **`HLN_Candidate_CPT`** — registers `hln_candidate` with every spec §4 field as post meta (`_hln_*`), plus custom post statuses (`hln_new`, `hln_building`, `hln_ready`, `hln_changes_required`, `hln_published`, `hln_rejected`, `hln_archived`) that represent the full spec §18 lifecycle. A daily cron sweeps anything still `hln_new` after 3 days to `hln_archived` — anything already promoted past `hln_new` is exempt.
- **`HLN_Dedup`** — an exact-URL check at Stage B, plus a scheduled fuzzy pass (entity + near-duplicate headline via `similar_text()`) against both the archive and other pending candidates. Sets `duplicate_of`; duplicates are demoted in trending, never deleted.
- **`HLN_Trending`** — computes a fully explainable, fully configurable trending score. See "Explainable, configurable trending scoring" below.

## Feature Race Calendar → Story Candidate link (v0.2.0)

The calendar used to be an isolated data source — `HLN_Race_Data` populated
`hln_race_calendar` directly, with no path into the candidate pipeline.
`HLN_Race_Candidate_Link` closes that gap deterministically:

```
Feature Race Calendar -> Racing Intelligence -> Story Candidate -> Generate -> QC -> Review
```

- Runs on the same `hln_race_calendar_poll` cron event, after the calendar
  adapter (priority 10) and racing-intelligence assembly (priority 20), at
  priority 30 — so intelligence is already available when a candidate is created.
- **Deterministic trigger, not fuzzy matching**: a calendar entry whose
  race date falls within the Preview Window (default 3 days ahead)
  becomes a Preview candidate; one whose race date has passed, within the
  Result Window (default 3 days back), becomes a Result candidate. Both
  windows are Settings-configurable.
- **Direct link, not headline text**: each candidate carries
  `race_calendar_id` meta pointing at the exact `hln_race_calendar` row.
  `HLN_Racing_Intelligence::get_for_entry()` is looked up by that ID.
- **Duplicate-proof by construction**: `hln_race_calendar` carries
  `preview_candidate_id`/`result_candidate_id` columns, written with an
  `... WHERE column IS NULL` guard. A given entry can produce at most one
  Preview and one Result candidate, full stop — not "usually," guaranteed
  by the write itself.
- **Fuzzy matching demoted to a fallback**: `HLN_Story_Generator`'s
  racing-intelligence lookup checks a candidate's `race_calendar_id`
  first; the old shared-words headline match only runs for candidates
  with no `race_calendar_id` — e.g. a general news-channel candidate that
  happens to mention a race but wasn't created through this link.
- Also respects `HLN_Kill_Switch` — a killed source's calendar entries
  are left unlinked, not force-created.
- Cross-pipeline duplicates (a calendar-linked candidate and an
  independently-triaged intake-log candidate about the same race) aren't
  prevented at creation — `HLN_Dedup`'s existing fuzzy pass catches and
  demotes those the same way it catches any other near-duplicate.

## Templates & generation (Phase 5)

- **`HLN_Templates`** — one template per story type (`news`, `preview`, `result`, `feature`, `breeding`, `industry`), stored as data and admin-editable on the Style Templates screen, following the same seed+override pattern as the Source Registry. Result and Feature carry the concrete rules from spec §12's worked examples; Preview's source-credit requirement is a toggle flagged unconfirmed rather than assumed; News/Breeding/Industry are schema-only placeholders (no worked example existed to seed them from).
- Byline (`hln_default_byline`) and the Published-By field (`_hln_guest_author`) are set on every candidate at Stage B and stay human-editable through the review screen. The byline author is auto-included as one of the candidate's planned tags (Hard Requirement 8), never a separate field.

## Generation-provider integration contract (v0.2.0)

`HLN_Story_Generator` implements `HLN_Generator_Interface`. Per Hard
Requirement 4, the actual content-generation provider is never named or
hardcoded anywhere in this plugin:

```
HLN_Story_Generator -> hln_generation_provider -> external configured implementation
```

- **Two configuration paths, no third option**: the `hln_generation_provider`
  filter (primary — receives the full payload, can vary by candidate), or
  the `hln_generation_provider_class` option (an autoloadable class name,
  used only when the filter returns nothing). **No provider ships with
  this plugin.**
- **Documented input/output schema**: the full docblock in
  `class-hln-story-generator.php` specifies exactly what a provider
  receives (`candidate`, `template`, `racing_intelligence`) and must
  return (`brief`, `feature`, `social_snippet`, `summary`, `headlines[]`).
- **Clean failure handling**: a thrown exception from `generate()` is
  caught — never a fatal error — and routes the candidate straight to
  Changes Required with the exception message as a QC flag
  (`generation_failed` in the audit log). A structurally invalid return
  (missing key, wrong type) fails `validate_provider_result()` the same
  way. **No placeholder or fabricated prose is produced in any failure path.**
- **QC stays in this codebase regardless of provider**: entity presence,
  template word-count adherence, and headline strength are checked by
  `HLN_Story_Generator` itself, not delegated to the provider.
- **Admin status, not a black box**: `HLN_Story_Generator::get_provider_status()`
  powers a "Generation Provider" panel on the Settings screen —
  Configured/Not Configured, Available/Unavailable, and the last error if
  any — without ever triggering a real generation call. The Editorial
  Dashboard also shows a warning banner when nothing is configured.

## Editorial dashboard & publish (Phase 6)

- **`HLN_Dashboard`** — the six-column board (Incoming/Recommended split by trending score, not stored status) plus the single review screen. Three actions: Edit inline (saves format_outputs), Publish, Reject.
- Publish is blocked server-side (not just via a disabled button) until the tags/category confirmation checkbox is submitted, and unconditionally blocked — regardless of any other field — when `requires_source_clearance` is set.
- Publish creates/updates a standard `post` with status **`pending`**, never `publish`; assigns a region → sub-category term hierarchy (defensively — see "WordPress integration hardening" below), tags (including the author tag), `_hln_guest_author`, and the non-removable `_hln_source_credit` meta.
- The Review Story screen shows a "Why This Score" breakdown (see below) and the full audit trail for that candidate.

## Kill switch — service-level, not just UI (v0.2.0)

`HLN_Kill_Switch` centralises every check. The pipeline is human-triggered
today, but the switch is built for where it's going:

```
ingestion -> candidate generation -> generation -> publishing
```

- **Global switch**: blocks automatic advancement everywhere.
- **Per-source switch**: blocks it for one source only.
- **Checked inside the business logic, not the UI**: `HLN_Triage::process_row()`
  (intake → candidate), `HLN_Race_Candidate_Link::link_calendar_entries()`
  (calendar → candidate), and `HLN_Story_Generator::generate_draft()`
  (candidate → generation) all call `HLN_Kill_Switch` directly. The
  dashboard additionally disables the "Generate Draft" button and shows a
  badge for clarity, but the enforcement doesn't depend on that UI.
- **Publish and Reject are deliberately exempt** — those are the human
  review decision itself, the thing Hard Requirement 5 exists to require.
  Gating a human's own deliberate Publish click behind an automation
  switch would contradict "manual editorial actions may remain available."
- Every toggle is logged to the audit trail as `kill_switch_changed`,
  scoped to the affected source (or global).

## Explainable, configurable trending scoring (v0.2.0)

Every weight is now a Settings-editable value (`hln_trending_weights`,
`HLN_Trending::get_weights()`), not a hard-coded editorial rule: source
authority, recency, cross-source corroboration, entity/racing
significance, historical HarnessLink performance, X/social signal, a
breaking-news boost multiplier, the duplicate-demotion factor, the Tier 2
score threshold, and the dashboard's Recommended threshold.

`HLN_Trending::compute()` stores the full breakdown as
`_hln_trending_breakdown` — every component's raw value, its weight, and
its contribution, plus whether the breaking-news boost or duplicate
demotion applied — shown on the Review Story screen under "Why This
Score." A score of 91 is always traceable to exactly which factors
produced it.

## Audit trail (v0.2.0 — generalised)

`HLN_Audit_Log` is the single read/write layer for `hln_audit_log`, used
by every class in the plugin (`HLN_Candidate_CPT::append_audit()` is now a
thin wrapper around it). Every row carries `user_id` (via
`get_current_user_id()`) and a timestamp; `candidate_id` is nullable so
system-level events (a source disabled, the kill switch toggled) can be
recorded with `source_slug` instead of forcing them onto an unrelated candidate.

Events written today: `candidate_created`, `candidate_updated`,
`source_attached`, `duplicate_check`, `tier_assigned`,
`generation_requested`, `generation_completed`, `generation_failed`,
`generation_blocked`, `qc_passed`, `qc_failed`, `review_approved`,
`review_rejected`, `published`, `manual_override` (publishing from a
status other than Ready for Review), `edited_inline`, `ttl_archived`,
`source_enabled`, `source_disabled`, `kill_switch_changed`. "Changes
Required" itself isn't a separate log line — `qc_failed` is the event that
causes that status transition, so logging both would be a duplicate entry
for the same moment. There is no separate "candidate assigned" concept in
this build (no reviewer-assignment workflow exists yet).

## Outbound (Phase 7)

- **`HLN_Outbound_RSS`** — `/feed/hln-all/`, `/feed/hln-region-{region}/`, `/feed/hln-breaking/` (Tier 1 only), registered via `add_feed()` rather than the site's own `/feed/` path — approved deviation, see "Deviations from spec." Carries `region`/`tier`/`source`/`entity` via an `hln:` RSS 2.0 namespace extension. **All four feed URLs (plus the public REST equivalents) are listed with clickable links on the Settings screen** — nobody needs to know the `add_feed()` implementation detail to find them.
- **`HLN_Public_API`** — REST stubs at `/wp-json/hln/v1/public/{stories,trending,feed.rss,feed.json,popular}`. No auth/rate-limiting (a plain TODO comment, deferred per spec §19). `trust_score`, `verify_against_official`, `duplicate_of`, and `requires_source_clearance` are stripped from every response unconditionally.
- **`HLN_Syndication`** — partner push, governing-body distribution, and social auto-post stubs, all off by default, each behind its own Settings toggle and only active once a filter/endpoint is actually configured.
- **`HLN_Popular`** — ranks published newsroom posts by a placeholder score (`views_count`, `engagement_score`, `avg_time_on_page` — all real postmeta fields, all zero until a real analytics integration writes to them).
- **`HLN_Insider`** — weekly WP-Cron job assembling a **draft** post from top Popular stories, the coming week's feature-race calendar, and recent stewards/market-mover items. Never auto-sent — no email-sending code exists in this class at all.

---

## Deviations from spec (all reviewed and approved)

| Deviation | Why | Where |
|---|---|---|
| Outbound feeds live at `/feed/hln-all/`, `/feed/hln-region-{region}/`, `/feed/hln-breaking/` instead of the spec's literal `/feed`, `/feed/{region}`, `/feed/breaking` | Claiming the bare `/feed/` path would override HarnessLink's existing site-wide feed | `class-hln-outbound-rss.php`; URLs exposed on the Settings screen |
| Feature-race calendar extraction is a generic best-effort `<table>` reader, not real per-jurisdiction scraping | No confirmed per-body markup available to build real selectors from | `class-hln-race-calendar-adapter.php` — architected for jurisdiction adapters (HRNSW, HRNZ, USTA, etc.) to be added later without changing `HLN_Race_Data`; none are shipped, deliberately, until real markup is confirmed |
| Preview/Result candidate creation uses a fixed day-window trigger ("fields available" proxy) rather than a confirmed runner-list signal | This build's calendar extraction doesn't capture a confirmed field/runner list per race | `class-hln-race-candidate-link.php`; windows are Settings-configurable |
| No generation provider ships with the plugin | Hard Requirement 4 forbids naming one, and none is available in this environment regardless | `class-hln-story-generator.php` |
| Feature race calendar / monitored-page fetch+diff extraction (Phase 2) remains best-effort/generic | No real per-body markup available; same reasoning as the calendar adapter above | `class-hln-race-data.php` |

## WordPress integration hardening (v0.2.0)

None of the WordPress-integration code below has been run against a live
WordPress database in this environment — there is no WP/MySQL instance
available in this sandbox. It is defensively written and lint-clean, but
**integration-unverified** until exercised on staging. What changed in
this pass:

- **`HLN_Dashboard::get_or_create_category()`/`get_or_create_term()`** —
  rewritten to check `is_wp_error()` at every `get_terms()`/`wp_insert_term()`
  call, handle the `term_exists` race explicitly (WP_Error carries the
  existing term ID in its error data), sanitize/length-cap term names
  before use, and never hard-fail the Publish action on a taxonomy error —
  a failure is logged to the audit trail (`candidate_updated`, with the
  specific error) and the post is still created, just without that
  category/tag.
- **Tag assignment** (`wp_set_post_terms`) — inputs are sanitized and
  length-capped (`HLN_Dashboard::sanitize_tags()`); a failure is caught
  and logged the same way, not allowed to abort the publish.
- **Feed rewrite registration/flushing** (`HLN_Outbound_RSS`) — guarded on
  two levels so it is never a per-request cost: admin-context only, and a
  stored-version check so it only actually calls `flush_rewrite_rules()`
  once per plugin version, not routinely.

## Staging Verification Checklist

Before relying on this plugin against real WordPress/taxonomy data,
verify on a staging site:

- [ ] **Category/tag creation on Publish** — confirm `get_or_create_category()`
      creates the correct region → sub-category parent/child term
      hierarchy, and that re-publishing an already-linked candidate
      updates rather than duplicates the WordPress post.
- [ ] **`term_exists` race handling** — publish two candidates that
      resolve to the same new category/tag close together; confirm
      neither errors and both end up pointing at one term.
- [ ] **Outbound feed URLs resolve** — hit each of the four `/feed/hln-*/`
      URLs listed on Settings and confirm valid RSS 2.0 with the `hln:`
      namespace fields present, after at least one post has gone through
      Publish → manually set to `publish` in wp-admin.
- [ ] **Feed rewrite rules survive a real activation/deactivation cycle**
      — deactivate, reactivate, confirm the feed URLs still resolve
      without a manual "Save Changes" on Permalinks.
- [ ] **Custom post statuses render correctly** in the `hln_candidate` WP
      list table (Story Candidates screen) — status labels, counts, and
      filtering all depend on `register_post_status()` behaving as
      expected in the actual wp-admin UI.
- [ ] **`hln_audit_log` schema migration** — this table shipped in an
      earlier version with `candidate_id NOT NULL` and no `user_id`/
      `source_slug` columns; confirm `dbDelta()` actually relaxes
      `candidate_id` to nullable and adds the new columns on an
      already-installed site, rather than silently leaving the old schema in place.
- [ ] **X API calls** — `HLN_X_Poller` and `HLN_Trending_Signal` are
      written to the public X API v2 shape but have never been run
      against a real bearer token in this environment.
- [ ] **PDF text extraction** — the dependency-free extractor in
      `HLN_Parsing_Utils` has not been tested against real stewards-report
      PDFs from any governing body; confirm it degrades gracefully
      (empty string, not an error) on scanned/image-only PDFs.

---

## Complete plugin structure (all 7 phases)

```
hl-newsroom/
├── hl-newsroom.php                       Bootstrap, constants, activation/deactivation, hln_init()
├── README.md
├── assets/{css,js}/admin.css, admin.js
└── includes/
    ├── class-hln-sources.php             Phase 1 — Source Registry + verified-social sub-registry (P3, extended v0.2.0)
    ├── class-hln-admin.php               Phase 1+ — every admin screen except the dashboard/review
    ├── class-hln-db.php                  Phase 2+ — schema installer, all 6 tables
    ├── class-hln-parsing-utils.php       Phase 2 — shared extraction helpers (PDF text, excerpts, entities)
    ├── class-hln-cron-utils.php          Phase 2/3 — shared WP-Cron interval helpers
    ├── class-hln-intake-log.php          Phase 2 — shared hln_intake_log read/write
    ├── class-hln-stewards-parser.php     Phase 2 — stewards-report parsing + USTA clearance gating
    ├── class-hln-email-intake.php        Phase 2 — inbound-parse webhook
    ├── class-hln-race-calendar-adapter.php v0.2.0 — jurisdiction-adapter interface + generic default
    ├── class-hln-race-data.php           Phase 2 — governing-body adapters + feature-race calendar
    ├── class-hln-racing-intelligence.php Phase 2 — archive cross-reference per calendar entry
    ├── class-hln-rss-intake.php          Phase 3 — per-source RSS polling
    ├── class-hln-x-poller.php            Phase 3 — verified-social (X) allow-list poller
    ├── class-hln-trending-signal.php     Phase 3 — broad X trending scan (own table only)
    ├── class-hln-audit-log.php           v0.2.0 — centralised hln_audit_log read/write, candidate + system events
    ├── class-hln-kill-switch.php         v0.2.0 — centralised, service-level kill-switch checks
    ├── class-hln-candidate-cpt.php       Phase 4 — Story Candidate CPT, statuses, TTL sweep
    ├── class-hln-race-candidate-link.php v0.2.0 — deterministic calendar -> candidate link
    ├── class-hln-triage.php              Phase 4 — Stage A/B pre-ingestion gate
    ├── class-hln-dedup.php               Phase 4 — exact + fuzzy duplicate detection
    ├── class-hln-trending.php            Phase 4 — configurable/explainable trending score + GET /trending
    ├── class-hln-templates.php           Phase 5 — style templates (data-driven)
    ├── class-hln-story-generator.php     Phase 5 — generator interface + QC (no provider ships; completed contract v0.2.0)
    ├── class-hln-dashboard.php           Phase 6 — dashboard, review screen, publish, kill switch
    ├── class-hln-outbound-rss.php        Phase 7 — custom RSS feeds
    ├── class-hln-public-api.php          Phase 7 — public REST stubs
    ├── class-hln-syndication.php         Phase 7 — partner/governing-body/social stubs
    ├── class-hln-popular.php             Phase 7 — placeholder-scored popularity ranking
    └── class-hln-insider.php             Phase 7 — weekly draft newsletter
```

## Notes

- Registered sources are defined in `includes/class-hln-sources.php` and
  extensible via the `hln_sources` filter.
- Admin edits (add/edit/disable) are stored in the `hln_source_overrides`
  option and merged over the seed list at read time.
- No source article body is ever fetched or stored in full — every parser
  (email, PDF attachment, monitored page, stewards report) is capped to a
  headline, short excerpt, entities, and at most one short quote.
