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

## Current status (Phase 2)

Plugin bootstrap, the Source Registry, and the first two intake channels:
the news@ inbound-email webhook and governing-body race-data adapters
(including the feature-race calendar and racing-intelligence layer).
Triage, dedup, trending scoring, story generation, and the editorial
dashboard do not exist yet — those land in later phases. Nothing in this
phase auto-publishes anything or writes to the live site.

## Pages

- **Dashboard** — Registry stats overview
- **Sources** — Add, edit, or disable entries in the Source Registry
- **Settings** — Attribution, category taxonomy, premium defaults, and email-intake webhook signing key
- **Intake Log** — Raw items from every intake channel (processed / unclassified / quarantined), plus the feature race calendar

---

## Settings Reference

| Setting | Description |
|---|---|
| Default Byline | `hln_default_byline` — used on every generated draft unless overridden per-post at review time. Defaults to "HarnessLink Media". Never set to a source's own name. |
| Inbound Webhook Signing Key | `hln_inbound_email_signing_key` — signing key from the inbound-parse email provider (Mailgun payload assumed by default). The `/wp-json/hln/v1/inbound-email` endpoint rejects every request until this is set. |
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

---

## Intake channels (Phase 2)

| Channel | Class | Detail |
|---|---|---|
| Email | `HLN_Email_Intake` | REST endpoint `POST /wp-json/hln/v1/inbound-email`. Verifies the inbound-parse webhook signature, matches the sender against the Source Registry by domain, and — only on a match — extracts a headline, short excerpt, entities, and PDF attachment text. Unmatched senders are logged as Unclassified and never become a Story Candidate. |
| Race data | `HLN_Race_Data` | Per-source WP-Cron poll at each source's Check Frequency. Uses an API-adapter extension point (`hln_race_data_api_adapter_{slug}` filter) where a governing body has a confirmed API — none do yet in the seeded registry — and a monitored-page fetch + diff job everywhere else. |
| Feature race calendar | `HLN_Race_Data::run_calendar_for_all_jurisdictions()` | Runs across every enabled official-body source, not a single market. Real per-body page markup isn't known yet, so extraction is a generic best-effort table reader, overridable per source via the `hln_race_calendar_selectors` filter once real markup is confirmed. |
| Stewards reports | `HLN_Stewards_Parser` | Invoked from within the email and race-data channels when a document looks like a stewards report. USTA stewards/ruling material is always flagged `requires_source_clearance = true` and quarantined — republishing/rewriting it isn't cleared under USTA's terms. Other jurisdictions record a `confirm_status` field for the same reason, without the hard block. |
| Racing intelligence | `HLN_Racing_Intelligence` | Assembles a structured (non-prose) record per feature-race-calendar entry — archive cross-references for prior results/mentions — for the story generator to draw on starting in Phase 5. Fields with no real data source yet (barrier history, form/speed figures) are left as honest empty arrays rather than fabricated. |

## Database tables (added Phase 2)

| Table | Purpose |
|---|---|
| `hln_intake_log` | Every raw item from any intake channel, with its processed/unclassified/quarantined status. RSS and X (Phase 3) write to this same table. |
| `hln_race_calendar` | Feature-race-calendar entries per jurisdiction. |
| `hln_race_intelligence` | Assembled racing-intelligence payload per calendar entry. |
| `hln_monitored_state` | Last-seen content hash per monitored-page source, for the fetch + diff job. |

## Notes

- Registered sources are defined in `includes/class-hln-sources.php` and
  extensible via the `hln_sources` filter.
- Admin edits (add/edit/disable) are stored in the `hln_source_overrides`
  option and merged over the seed list at read time.
- No source article body is ever fetched or stored in full — every parser
  (email, PDF attachment, monitored page, stewards report) is capped to a
  headline, short excerpt, entities, and at most one short quote.
