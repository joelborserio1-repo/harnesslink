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

## Current status (Phase 1)

Plugin bootstrap and the Source Registry only. No intake, triage,
generation, or dashboard logic exists yet — those land in later phases.

## Pages

- **Dashboard** — Registry stats overview
- **Sources** — Add, edit, or disable entries in the Source Registry
- **Settings** — Attribution, category taxonomy, and premium defaults

---

## Settings Reference

| Setting | Description |
|---|---|
| Default Byline | `hln_default_byline` — used on every generated draft unless overridden per-post at review time. Defaults to "HarnessLink Media". Never set to a source's own name. |
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

## Notes

- Registered sources are defined in `includes/class-hln-sources.php` and
  extensible via the `hln_sources` filter.
- Admin edits (add/edit/disable) are stored in the `hln_source_overrides`
  option and merged over the seed list at read time.
- No database tables are created in this phase.
