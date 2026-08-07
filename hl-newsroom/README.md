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

## Current status (Phase 7 — complete)

All seven phases are built: bootstrap and Source Registry, all four intake
channels, the triage gate and Story Candidate CPT, style templates and the
story generator, the editorial dashboard with WordPress publish
integration, and the outbound layer (RSS, public API stubs, syndication
stubs, Popular/Insider). See "Complete plugin structure" below for the
full map.

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
| Regions | `hln_regions` — top-level category list (one per line), matching the live site's region structure. |
| Sub-Categories | `hln_subcategories` — sub-category list (one per line) applied under every region. |
| Premium Defaults by Story Type | `hln_is_premium_defaults` — default `is_premium` access-tier flag per story type. Independent of category; editable per-draft at review time once that screen exists. |

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
| Auto-Publish | Per-source flag, always defaults to off. Governed by a kill switch and audit-trail log added in a later phase — nothing publishes without human review regardless of this setting. |
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
| Verification Method | How this was confirmed as the genuine, named account — required |
| Region | Optional |
| Check Frequency | Poll interval, e.g. `15m` |
| Enabled | Disable an account without removing it |

Never seeded with placeholder handles — every row must be added by a human
who individually confirmed the account, per spec §2.3.

---

## Intake channels

| Channel | Class | Detail |
|---|---|---|
| Email | `HLN_Email_Intake` | REST endpoint `POST /wp-json/hln/v1/inbound-email`. Verifies the inbound-parse webhook signature, matches the sender against the Source Registry by domain, and — only on a match — extracts a headline, short excerpt, entities, and PDF attachment text. Unmatched senders are logged as Unclassified and never become a Story Candidate. |
| Race data | `HLN_Race_Data` | Per-source WP-Cron poll at each source's Check Frequency. Uses an API-adapter extension point (`hln_race_data_api_adapter_{slug}` filter) where a governing body has a confirmed API — none do yet in the seeded registry — and a monitored-page fetch + diff job everywhere else. |
| Feature race calendar | `HLN_Race_Data::run_calendar_for_all_jurisdictions()` | Runs across every enabled official-body source, not a single market. Real per-body page markup isn't known yet, so extraction is a generic best-effort table reader, overridable per source via the `hln_race_calendar_selectors` filter once real markup is confirmed. |
| Stewards reports | `HLN_Stewards_Parser` | Invoked from within the email, race-data, and RSS channels when a document looks like a stewards report. USTA stewards/ruling material is always flagged `requires_source_clearance = true` and quarantined — republishing/rewriting it isn't cleared under USTA's terms. Other jurisdictions record a `confirm_status` field for the same reason, without the hard block. |
| Racing intelligence | `HLN_Racing_Intelligence` | Assembles a structured (non-prose) record per feature-race-calendar entry — archive cross-references for prior results/mentions — for the story generator to draw on starting in Phase 5. Fields with no real data source yet (barrier history, form/speed figures) are left as honest empty arrays rather than fabricated. |
| RSS | `HLN_RSS_Intake` | One poll per source whose Ingestion Method is `rss`, at that source's Check Frequency. Trade-press items are always flagged `verify_against_official` — trade press is colour/quotes/angle only, never unverified fact. |
| Verified Social (X) | `HLN_X_Poller` | Polls only the explicitly vetted allow-list — no keyword/hashtag search. Every candidate is unconditionally flagged `verify_against_official`, regardless of trust or trending. The original post's wording is never reproduced as a quote or excerpt; `body_excerpt` is built from detected entities and a link, not the post's own text. Photo/video media from these posts is always `agency_flagged`. |
| Trending signal | `HLN_Trending_Signal` | A separate, broader X scan — not limited to the allow-list — whose only job is detecting unusual attention on a horse/trainer/race. Structurally incapable of creating a Story Candidate or supplying a fact/quote: it has no dependency on `HLN_Intake_Log` and writes exclusively to its own `hln_trending_signal` table. |

## Database tables

| Table | Purpose |
|---|---|
| `hln_intake_log` | Every raw item from any intake channel, with its processed/unclassified/quarantined/discarded status. Email, race-data, RSS, and X all write to this same table. A `candidate_id` column links a promoted row to its `hln_candidate` post. |
| `hln_race_calendar` | Feature-race-calendar entries per jurisdiction. |
| `hln_race_intelligence` | Assembled racing-intelligence payload per calendar entry. |
| `hln_monitored_state` | Last-seen watermark (content hash, or a last-seen item id for RSS/X) per polled source, so a poll only surfaces genuinely new content. |
| `hln_trending_signal` | Raw output of the broad X trending scan (term, sample count, detection window). Never touched by any other class. |
| `hln_audit_log` | Append-only lifecycle log per candidate (Hard Requirement 5) — source detected, duplicate check, tier assigned, draft generated, QC result, pending post created, reviewer action. Shown on the Review Story screen. |

---

## Triage, Story Candidates & trending (Phase 4)

- **`HLN_Triage`** — WP-Cron job (every 5 minutes) running Stage A (rule-based: headline present, excerpt long enough, has a date, not an exact-URL duplicate) against every processed/quarantined intake-log row. Failures are marked `discarded` on the existing log row and never become a candidate. Rows that pass become a full `hln_candidate` post (Stage B) via `HLN_Candidate_CPT::create_from_intake_row()`.
- **`HLN_Candidate_CPT`** — registers `hln_candidate` with every spec §4 field as post meta (`_hln_*`), plus custom post statuses (`hln_new`, `hln_building`, `hln_ready`, `hln_changes_required`, `hln_published`, `hln_rejected`, `hln_archived`) that represent the full spec §18 lifecycle. A daily cron sweeps anything still `hln_new` after 3 days to `hln_archived` — anything already promoted past `hln_new` is exempt.
- **`HLN_Dedup`** — an exact-URL check at Stage B, plus a scheduled fuzzy pass (entity + near-duplicate headline via `similar_text()`) against both the archive and other pending candidates. Sets `duplicate_of`; duplicates are demoted in trending, never deleted.
- **`HLN_Trending`** — computes a trending score from source trust, recency, cross-source corroboration, entity significance, a historical-performance factor (Phase 7's `HLN_Popular`, itself placeholder-valued until real analytics exist), and duplicate demotion. Also reads Phase 3's `hln_trending_signal` table and folds matching entities' raw X volume into the score — completing the wiring Phase 3 deliberately left as a placeholder. Exposes `GET /wp-json/hln/v1/trending` per spec §5.2.

## Templates & generation (Phase 5)

- **`HLN_Templates`** — one template per story type (`news`, `preview`, `result`, `feature`, `breeding`, `industry`), stored as data and admin-editable on the Style Templates screen, following the same seed+override pattern as the Source Registry. Result and Feature carry the concrete rules from spec §12's worked examples; Preview's source-credit requirement is a toggle flagged unconfirmed rather than assumed; News/Breeding/Industry are schema-only placeholders (no worked example existed to seed them from).
- **`HLN_Story_Generator`** — implements `HLN_Generator_Interface`. Per Hard Requirement 4, the actual content-generation provider is never named anywhere in this codebase; it's resolved exclusively via the `hln_generation_provider` filter, which must return an object implementing `HLN_Generation_Provider_Interface`. **No provider ships with this plugin.** Until one is wired up, generation deterministically produces a "Changes Required" result (`quality_score = 0`, a QC flag naming the missing provider) instead of fabricating prose. QC itself — entity presence, template word-count adherence, headline strength — runs in this class regardless of which provider is configured, since that logic isn't "the provider."
- Byline (`hln_default_byline`) and the Published-By field (`_hln_guest_author`) are set on every candidate at Stage B and stay human-editable through the review screen. The byline author is auto-included as one of the candidate's planned tags (Hard Requirement 8), never a separate field.

## Editorial dashboard & publish (Phase 6)

- **`HLN_Dashboard`** — the six-column board (Incoming/Recommended split by trending score, not stored status) plus the single review screen. Three actions: Edit inline (saves format_outputs), Publish, Reject.
- Publish is blocked server-side (not just via a disabled button) until the tags/category confirmation checkbox is submitted, and unconditionally blocked — regardless of any other field — when `requires_source_clearance` is set.
- Publish creates/updates a standard `post` with status **`pending`**, never `publish`; assigns a region → sub-category term hierarchy, tags (including the author tag), `_hln_guest_author`, and the non-removable `_hln_source_credit` meta.
- Kill-switch panel at the top of the dashboard: a global toggle and a per-source toggle (listed for any source with Auto-Publish enabled). Nothing in this build auto-publishes or auto-advances a candidate regardless of these switches — they're checked defensively inside `HLN_Story_Generator::generate_draft()` so the capability has real teeth the day an automated path is ever added.

## Outbound (Phase 7)

- **`HLN_Outbound_RSS`** — `/feed/hln-all/`, `/feed/hln-region-{region}/`, `/feed/hln-breaking/` (Tier 1 only), registered via `add_feed()` rather than the site's own `/feed/` path — see Deviations. Carries `region`/`tier`/`source`/`entity` via an `hln:` RSS 2.0 namespace extension.
- **`HLN_Public_API`** — REST stubs at `/wp-json/hln/v1/public/{stories,trending,feed.rss,feed.json,popular}`. No auth/rate-limiting (a plain TODO comment, deferred per spec §19). `trust_score`, `verify_against_official`, `duplicate_of`, and `requires_source_clearance` are stripped from every response unconditionally.
- **`HLN_Syndication`** — partner push, governing-body distribution, and social auto-post stubs, all off by default, each behind its own Settings toggle and only active once a filter/endpoint is actually configured.
- **`HLN_Popular`** — ranks published newsroom posts by a placeholder score (`views_count`, `engagement_score`, `avg_time_on_page` — all real postmeta fields, all zero until a real analytics integration writes to them).
- **`HLN_Insider`** — weekly WP-Cron job assembling a **draft** post from top Popular stories, the coming week's feature-race calendar, and recent stewards/market-mover items. Never auto-sent — no email-sending code exists in this class at all.

---

## Complete plugin structure (all 7 phases)

```
hl-newsroom/
├── hl-newsroom.php                       Bootstrap, constants, activation/deactivation, hln_init()
├── README.md
├── assets/{css,js}/admin.css, admin.js
└── includes/
    ├── class-hln-sources.php             Phase 1 — Source Registry + verified-social sub-registry (P3)
    ├── class-hln-admin.php               Phase 1+ — every admin screen except the dashboard/review
    ├── class-hln-db.php                  Phase 2+ — schema installer, all 6 tables
    ├── class-hln-parsing-utils.php       Phase 2 — shared extraction helpers (PDF text, excerpts, entities)
    ├── class-hln-cron-utils.php          Phase 2/3 — shared WP-Cron interval helpers
    ├── class-hln-intake-log.php          Phase 2 — shared hln_intake_log read/write
    ├── class-hln-stewards-parser.php     Phase 2 — stewards-report parsing + USTA clearance gating
    ├── class-hln-email-intake.php        Phase 2 — inbound-parse webhook
    ├── class-hln-race-data.php           Phase 2 — governing-body adapters + feature-race calendar
    ├── class-hln-racing-intelligence.php Phase 2 — archive cross-reference per calendar entry
    ├── class-hln-rss-intake.php          Phase 3 — per-source RSS polling
    ├── class-hln-x-poller.php            Phase 3 — verified-social (X) allow-list poller
    ├── class-hln-trending-signal.php     Phase 3 — broad X trending scan (own table only)
    ├── class-hln-candidate-cpt.php       Phase 4 — Story Candidate CPT, statuses, TTL sweep
    ├── class-hln-triage.php              Phase 4 — Stage A/B pre-ingestion gate
    ├── class-hln-dedup.php               Phase 4 — exact + fuzzy duplicate detection
    ├── class-hln-trending.php            Phase 4 — trending score + GET /trending
    ├── class-hln-templates.php           Phase 5 — style templates (data-driven)
    ├── class-hln-story-generator.php     Phase 5 — generator interface + QC (no provider ships)
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
