# Harnesslink — Discovered Facts

Verified against the live WordPress database on 20 July 2026. This is real data,
not assumption. Claude Code should treat it as authoritative and update it as
more is learned.

## Server / environment

| | |
|---|---|
| Host | xCloud (Ubuntu, `onidel-oni-5`) |
| Site path | `/var/www/harnesslink.com` |
| SSH user | `u6_harnesslink` |
| Database | `db6_harnesslink` |
| **Table prefix** | **`wzev_`** — NOT `wp_`. Randomised. |
| Disk | 687G total, 381G used, 306G free |
| DB dump (gzip) | ~360MB |

## Content volumes

| Type | Status | Count |
|---|---|---|
| attachment | inherit | 132,702 |
| **post** | **publish** | **62,558** |
| revision | inherit | 41,743 |
| post | draft | 26,638 |
| flamingo_contact | publish | 1,317 |
| lp_transaction | publish | 1,041 |
| ad_article | draft | 722 |
| post | trash | 722 |
| guest_author | publish | 602 |
| oembed_cache | publish | 549 |
| nav_menu_item | publish | 80 |
| elementor_library | publish | 70 |
| page | publish | 69 |
| advanced_ads | publish | 34 |
| wpcode | publish | 15 |
| edition | publish | 10 |
| podcast | publish | 8 |
| ppma_boxes | publish | 8 |
| archive-template | publish | 6 |
| acf-field | publish | 5 |
| editions | publish | 2 |
| footer | publish | 1 |
| um_directory | publish | 1 |
| wpdiscuz_form | publish | 1 |

## Media on disk

- **115GB** total in `wp-content/uploads`
- **92,910 original files**
- **680,616 generated thumbnails** (`.jpg` only — real total is higher)
- ~7.3 thumbnail variants per original

Uploads by year:

| Year | Size |
|---|---|
| 2024 | 25G |
| 2023 | 23G |
| 2021 | 19G |
| 2022 | 18G |
| 2025 | 15G |
| 2026 | 8.3G |
| wpallimport | 8.2G |
| 2020 | 61M |
| 2015–2019 | 1.7–2.8M each |

**Unexplained:** 132,702 attachment records vs 92,910 files on disk — potentially
~40k attachment rows pointing at missing files. Combined with the pre-2021 upload
cliff, this suggests the older archive was bulk-imported (note the 8.2GB
`wpallimport` directory) and images either live elsewhere or were never migrated.
**Must be resolved before cutover** — broken images across the back catalogue are
an existing SEO/UX problem we would otherwise faithfully reproduce.

## Systems in play (from post types and upload dirs)

| System | Evidence | Replacement status |
|---|---|---|
| Co-Authors Plus | `guest_author` × 602 | Must model. Bylines are a custom post type, not users. |
| PublishPress Authors | `ppma_boxes`, `ppmacf_field` | Possibly a second, overlapping author system — determine which is live |
| Leaky Paywall | `lp_transaction` × 1,041 | Real subscribers. Own workstream. |
| Ultimate Member | `um_form`, `um_directory` | **The "Directory" is user profiles, not content** |
| Advanced Ads Pro | `advanced_ads`, `advanced_ads_plcmnt` | 34 live ads. Replace with Revive/GAM/in-house |
| Elementor | `elementor_library`, `footer`, `archive-template` | Footer is an Elementor template — match design, not DOM |
| ACF | `acf-field`, `acf-field-group` | Articles may carry custom fields — catalogue required |
| Flamingo + CF7 | `flamingo_*`, `wpcf7_contact_form` | Form submissions storage |
| WPForms | uploads dir | Second forms system |
| wpDiscuz | `wpdiscuz_form` | Comments |
| Rank Math | uploads dir | SEO metadata — must migrate fully |
| Slider Revolution | `revslider` uploads | Check if still used; known perf/security issues |
| WP Staging | `wp-staging` uploads | Staging copies may be consuming disk |
| WP All Import | 8.2GB uploads | Historical bulk import — explains the archive |
| WPCode | `wpcode` × 15+11 | Custom code snippets — audit, may hide business logic |
| Podcast | `podcast` × 9 | "The Final Quarter Podcast" — custom post type |
| edition / editions | 10 + 2 | Likely "The Insider". Two similar types — one probably dead |
| ad_article | 724 (722 draft) | **Unidentified.** Sponsored content? Needs investigation |

## Open questions

1. **Permalink structure** — not yet captured. Highest priority; determines routing.
2. What are the 26,638 drafts? 30% of content unpublished is anomalous.
3. Which author system is live — Co-Authors Plus, PublishPress, or both?
4. What is `ad_article`, and why are 722 of 724 drafts?
5. `edition` vs `editions` — which is The Insider?
6. Do ~40k attachment records point at missing files?
7. What ACF fields exist on articles?

## Immediate Phase 0 wins (independent of rebuild)

- Purge 41,743 revisions — safe, reversible, measurable speed gain
- Empty trash (722 posts)
- Clear `oembed_cache` (549)
- Audit Flamingo inbound spam (209 spam records)
- Investigate the ~265GB of disk not accounted for by uploads
