# HarnessLink Newsroom — Functional Spec

Status: DRAFT — reconstructed from the HarnessLink Newsroom project brief for
internal review. Anywhere a concrete detail was not already fixed by the
brief, it is marked **[CONFIRM]** and should be corrected by HarnessLink
editorial/engineering before Phase 1 is treated as final.

Audience: the development team building `hl-newsroom`, plus HarnessLink
editorial staff (Bev and team) who will use the resulting dashboard.

---

## 1. Overview & goals

HarnessLink Newsroom is an internal WordPress plugin that helps the
HarnessLink editorial team notice harness-racing news faster, assemble
research on it, and draft house-style stories for a human editor to review
and publish. It is an intake-and-drafting aid, not an autonomous publisher.

Two constraints shape every section below:

- The plugin never republishes another outlet's article body. It extracts
  facts (who/what/when/where, a short excerpt, at most one short quote) and
  HarnessLink's own writers/generator produce original copy from those facts
  plus HarnessLink's own archive and racing-intelligence data.
- Nothing goes live on harnesslink.com without a human clicking Publish, with
  one narrow, explicitly-scoped exception defined in §7.1.

---

## 2. Sources

Every source is a row in the Source Registry (`HLN_Sources`), keyed by a
slug, and carries this schema:

| Field | Type | Notes |
|---|---|---|
| `label` | string | Display name, e.g. "United States Trotting Association" |
| `region` | enum | `usa` \| `canada` \| `australia` \| `new_zealand` \| `europe` |
| `source_type` | enum | `official` \| `trade-press` \| `verified-social` \| `race-data` |
| `url` | string | Feed/API/page URL |
| `ingestion_method` | enum | `api` \| `rss` \| `email` \| `monitored-page` \| `x-api` |
| `trust_score` | int 0–100 | Starting weight for triage/trending (§10, §5) |
| `check_frequency` | string | Cron-style interval, e.g. `15m`, `1h`, `6h` |
| `auto_publish` | bool | Per-source, default `false` (Hard Requirement 5) |
| `governing_body` | string\|null | Set for `official` and `race-data` rows |

A `region` here is the same top-level taxonomy used for post categories in
§12 — a source based in one region can still report on another (e.g. a
trade-press outlet covering a US race), so `region` on a source describes
the source's home jurisdiction, not every story it will ever produce.

### 2.1 Official governing bodies

These are the highest-trust sources — race-day fields/results/fixtures and
stewards material originate here. Seed list **[CONFIRM — verify exact
current names/URLs with HarnessLink editorial before go-live]**:

| Region | Body | ingestion_method (typical) |
|---|---|---|
| USA | United States Trotting Association (USTA) | api / monitored-page |
| Canada | Standardbred Canada | api / monitored-page |
| Australia | Harness Racing Australia (national) | monitored-page |
| Australia | Harness Racing New South Wales | monitored-page |
| Australia | Harness Racing Victoria | monitored-page |
| Australia | Queensland Harness Racing Board | monitored-page |
| Australia | Harness Racing South Australia | monitored-page |
| Australia | Racing and Wagering Western Australia — Harness | monitored-page |
| Australia | Tasracing — Harness | monitored-page |
| New Zealand | Harness Racing New Zealand (HRNZ) | api / monitored-page |
| Europe | Union Européenne du Trot (UET) | monitored-page |
| Europe | Le Trot (France) | monitored-page |
| Europe | Svensk Travsport (Sweden) | monitored-page |
| UK/IRE | British Harness Racing Club | monitored-page |

Official-body sources poll at a shorter `check_frequency` than trade press
(race-day fields/results are time-sensitive); a typical starting value is
`15m` on race days / `1h` otherwise, tuned per source in Phase 1's admin
screen rather than hardcoded.

### 2.2 Trade press

Hard-gated: anything sourced here is colour, quotes, or story angle only,
never treated as a verified fact on its own — every trade-press item is
flagged `verify_against_official = true` before it can reach generation
(§3.2, Hard Requirement enforcement in Phase 3). Seed list **[CONFIRM —
illustrative, verify against actual outlets HarnessLink wants to monitor]**:

| Region | Outlet |
|---|---|
| USA | Harness Racing Update (HRU) |
| USA | Hoof Beats (USTA magazine) |
| Australia | Trots Vision news |
| New Zealand | HRNZ news / Harnesslink NZ correspondents |
| Europe | Harness racing sections of national racing press |

Trade-press `check_frequency` is longer than official bodies —
**[CONFIRM default, e.g. `1h`]**.

### 2.3 Verified social (X)

A narrow, explicit allow-list — never a keyword or hashtag search (that is
the separate, broader trending scan in §15). Each entry is a sub-registry
row on `HLN_Sources`, distinct from the source-type schema above:

| Field | Type | Notes |
|---|---|---|
| `handle` | string | e.g. `@USTAracing` |
| `owning_entity` | string | The real organisation/person behind the handle |
| `verification_method` | string | How HarnessLink confirmed this is the genuine, named account (e.g. "linked from official body's own site", "X blue-check + cross-confirmed by governing body") |
| `date_added` | date | |
| `region` | enum | Same region taxonomy |

Seeded empty in Phase 1 (schema only); populated with real, individually
vetted accounts starting in Phase 3. Every candidate sourced (even partly)
from this channel is unconditionally flagged `verify_against_official =
true` and routed to manual review, regardless of trust or trending score
(Hard Requirement 10) — there is no trust threshold that bypasses this.

### 2.4 Race-data feeds

Structured data from governing bodies and third-party race-data providers:
fields, results, and fixtures/calendars. `data_type` on the resulting
Story Candidate is one of `result` \| `field` \| `fixture`.

Two sub-parts:

- **Per-body feeds/APIs**, where a governing body exposes one (§3.3's
  adapter pattern normalises each into the common shape).
- **Feature-race calendars**, run across every jurisdiction seeded in
  §2.1 — not a single market. Each calendar entry records: governing body,
  race name, date, grade, prize money. This is the input to the
  racing-intelligence layer (§2.4.1) and, later, to preview/result story
  generation (§12, §14).

Seeded empty in Phase 1 (schema only); adapters and calendar population are
Phase 2 work.

#### 2.4.1 Racing-intelligence layer

For a given feature-race-calendar entry plus its field (once available),
the racing-intelligence layer assembles a structured record — not prose —
consumed later by the story generator:

- Recent-performance summary for each runner
- Barrier-history lookup
- Trainer/driver statistics
- Prior results for that same race, cross-referenced against HarnessLink's
  own archive (matched by horse/trainer/driver entity against existing
  posts)
- Form data and speed/pace figures where available
- Previous winners of the race

This record attaches to the calendar entry. It is assembled in Phase 2 and
consumed (not generated) by the story generator in Phase 5.

---

## 3. Intake channels

### 3.1 Email intake

Decision: an **inbound-parse webhook** (the email provider POSTs parsed
email to our endpoint), not IMAP polling. Provider is not assumed in code —
the payload shape (Mailgun/Postmark/SendGrid-style) is picked and recorded
in a single config constant, not hardcoded as an architectural assumption.

Endpoint: `POST /wp-json/hln/v1/inbound-email`.

Processing rules:

- Sender must match an entry in `HLN_Sources` before anything else happens.
  Unmatched senders are logged to an "Unclassified" list and never produce
  a Story Candidate.
- Both the plain body and any PDF attachments are parsed (text + tables),
  plus links and embedded images.
- Per Hard Requirement 1 / §8, only headline, byline, publish date, a short
  excerpt, entities, and at most one short quote are extracted and stored —
  never the full body of the source material.
- `source_name` / `source_credit` are populated from the registry match
  (§16), not from free text in the email.

### 3.2 RSS

One polling job per RSS feed present in `HLN_Sources`, run at that source's
`check_frequency`. Normalises every item to: headline, URL, publish time,
excerpt, images, source — and inherits `trust_score` from the registry
entry. Any item from a `trade-press` source is flagged
`verify_against_official = true` before reaching generation (§2.2).

### 3.3 Governing-body adapter pattern

Where a governing body exposes a feed/API (§2.4), a dedicated per-source
adapter class normalises its native format into the common Story Candidate
shape (`data_type: result | field | fixture`). Where no feed/API exists, a
monitored-page fetch + diff job substitutes, reusing the same text/table
parsing utilities as the email PDF handling in §3.1 — one parsing
implementation, multiple entry points.

### 3.4 Verified X polling

Polls the X API for the explicit allow-list in §2.3 only — no keyword or
hashtag search (that's §15). Each post becomes a Story Candidate with
`source_type: verified-social`, retaining the original post URL. The
post's own text is not reproduced as a quote beyond what attribution
requires — link + paraphrase, not reproduction. Every candidate from this
channel is flagged `verify_against_official = true` unconditionally (Hard
Requirement 10). Media attached to these posts goes through the same
rights-check treatment as any other agency-flagged photo (§13) — appearing
on a verified account does not clear a repost of someone else's image.

---

## 4. Story Candidate schema

Custom post type `hln_candidate`. Full field list:

| Field | Type | Notes |
|---|---|---|
| `id` | int | Post ID |
| `source_name` | string | From registry match |
| `source_type` | enum | `official` \| `trade-press` \| `verified-social` \| `race-data` |
| `region` | enum | §2 taxonomy |
| `governing_body` | string\|null | |
| `headline` | string | As extracted, not final published headline |
| `body_excerpt` | string | Short excerpt only — never full body (§8) |
| `original_url` | string | |
| `published_at` | datetime | Source's publish time |
| `ingested_at` | datetime | |
| `entities` | object | Horses/trainers/drivers/tracks/races mentioned |
| `data_type` | enum | `result` \| `field` \| `fixture` \| `article` |
| `images` | array | |
| `video` | array | Each item carries `rights_holder`, `rights_confirmed` |
| `trust_score` | int | Inherited from source, adjustable by triage |
| `quality_score` | int | Set at generation time (§11, §14) |
| `trending_signal` | float\|null | Written only by §15's trending scan |
| `triage_status` | enum | `candidate` \| `promoted` \| `discarded` \| `archived` |
| `verify_against_official` | bool | |
| `requires_source_clearance` | bool | Hard Requirement 11 |
| `format_outputs` | object | Populated by the generator (§14) |
| `is_premium` | bool | Access-tier flag, independent of category (§12) |
| `duplicate_of` | int\|null | Set by dedup (§10) |

---

## 5. Trending Story Feed

### 5.1 Scoring inputs

Per Story Candidate: source trust, recency (breaking stories decay
fastest), cross-source corroboration (the same story appearing across
multiple `source_type`s raises the score and lowers the bar for faster
editorial action), entity significance (cross-referenced against the
HarnessLink archive), historical performance of similar story
types/sources, and duplicate demotion (duplicates are demoted in ranking,
never deleted, so an editor can still take a follow-up angle).

### 5.2 API

`GET /api/trending` returns, per candidate: `score`, `region`, `source`,
`story` (headline/summary), `type`, `corroborated_by`, `duplicate`,
`action` (suggested next step, e.g. "promote", "hold", "merge").

---

## 6. Watchlist & entities

Entity extraction (§3, §4) resolves mentions against a HarnessLink entity
watchlist — horses, trainers, drivers, tracks, and races already known to
the archive — used for dedup (§10), trending (§5), and racing-intelligence
cross-referencing (§2.4.1). **[CONFIRM: source of truth for the watchlist —
derived from existing HarnessLink post history, or a maintained list. Not
otherwise specified by the brief; Phase 4 can start from archive-derived
entities only.]**

---

## 7. Publishing & auto-publish

### 7.1 Auto-publish, kill switch, audit trail

`hln_auto_publish` is a per-source boolean on the Source Registry, default
`false`. A global kill switch and a per-source control both exist in the
dashboard (Phase 6) and, when engaged, block candidates from reaching
Ready for Review automatically.

**The only exception anywhere in this build**: a narrow Tier-1
structured-fact case — a `data_type: result` candidate from an `official`
source, above a defined trust/quality bar, containing only structured
facts already published by the governing body itself (e.g. a bare result
line), with no generated prose beyond a template-filled restatement of
those facts. Even in this case, the plugin's Publish action still only
moves the WP post to `pending`, never `publish` (Hard Requirement 5 /
§18) — "auto-publish" in this build means "auto-promote to pending for
fast human sign-off," not "goes live without a human." Every use of this
path is written to the audit-trail log table, unconditionally.

Every candidate's full lifecycle (source detected → duplicate check →
tier assigned → draft generated → QC result → pending post created →
reviewer action → published) is logged to an audit-trail table, visible on
the candidate's admin screen (Phase 6).

### 7.2 Outbound RSS

Custom feed endpoints populated automatically from `Published` status
only: `/feed` (all), `/feed/{region}`, `/feed/breaking` (Tier 1 only, §11).
Carries structured fields a stock WP feed doesn't — region, tier, entities,
source — via RSS 2.0 namespace extensions or a parallel JSON Feed output.

### 7.3 Public API

REST stubs only in Phase 7: `/wp-json/hln/v1/public/stories`,
`/public/trending`, `/public/feed.rss`, `/public/feed.json`,
`/public/popular`. Auth/rate-limiting is explicitly deferred (§19).
Internal-only fields — `trust_score`, `verify_against_official`,
`duplicate_of`, `requires_source_clearance` — are stripped from every
response unconditionally.

---

## 8. Source content handling

No parser anywhere in this build (email, RSS, monitored-page, PDF, stewards
report, X poller) fetches or stores a full source article body. Every
extraction is limited to: headline, byline, publish date, a short excerpt,
entities, and at most one short quote. This applies uniformly regardless
of `source_type` or `trust_score` — a high-trust official source gets the
same treatment as a low-trust one; trust affects scoring and routing, never
how much of the original is captured.

---

## 9. Popular content & Insider newsletter

Published stories are ranked by a performance score — views, social
engagement, time-on-page (§11's popularity axis). Real analytics
integration is out of scope for this build; Phase 7 stubs the data source
with placeholder fields (`views_count`, `engagement_score`,
`avg_time_on_page`) and wires the ranking logic so it activates once real
data flows in.

A weekly WP-Cron job ("Insider") assembles a **draft** newsletter post
from: top Published stories by Popular score, the coming week's
feature-race calendar (§2.4), and any available market-mover/stewards
items. Always left as a draft for manual editing — never auto-sent.

---

## 10. Pre-ingestion triage gate & retention

Two-stage gate, applied to every item from all four intake channels
(§3.1–§3.4):

- **Stage A** (lightweight, rule-based — not a full generation pass):
  source trust tier, entity/keyword match against the watchlist (§6),
  duplicate URL/hash check against the archive and other pending
  candidates, basic sanity checks (has a date, isn't a fragment, meets a
  minimum length). Anything failing Stage A is logged to a visible
  "Discarded/low value" list for audit but never becomes a full
  `hln_candidate` post and never reaches Stage B.
- **Stage B**: items clearing Stage A get the full `hln_candidate` record
  (§4), with entity extraction and trust scoring applied.

Dedup: each new candidate is checked against the existing archive
(`post_type=post`) and other pending candidates, matched by entity plus
near-duplicate headline/URL. A match sets `duplicate_of`; duplicates are
demoted in ranking, never deleted.

Retention: any `hln_candidate` with `triage_status = candidate` and no
editorial action taken for **3 days** is auto-archived/deleted. Anything
already promoted into a draft is exempt and follows the normal editorial
lifecycle instead.

---

## 11. Quality & popularity tiering

Three story tiers, used for routing speed and the `/feed/breaking` output
(§7.2), independent of `is_premium` (§12):

| Tier | Definition |
|---|---|
| Tier 1 | Breaking, structured official fact — results, stewards rulings, official announcements. Fastest decay in trending (§5.1); the only tier eligible for the §7.1 fast-path, and only then under the full conditions in §7.1 — tier alone never authorizes auto-publish. |
| Tier 2 | Standard news/preview/trade-press-corroborated stories. Normal editorial pace. |
| Tier 3 | Features, breeding, industry, evergreen. Longest shelf life, lowest urgency. |

`quality_score` (set at generation time, §14) is separate from tier —
tier describes the story's news urgency, quality_score describes how well
the generated draft executed on it.

---

## 12. Style templates & taxonomy

### 12.1 Category taxonomy

Top-level category = region: `USA`, `Canada`, `Australia`, `New Zealand`,
`Europe` — matching the live site structure. Sub-categories under each
region: `News`, `Entries`, `Results`, `Breeding`.

`is_premium` is a separate boolean access-tier flag, not a category or tag
— a story's region/sub-category placement and its premium status are
independent decisions.

A template's default category is derived from `region` (candidate/source)
+ `data_type` (e.g. `data_type: result` → the region's `Results`
sub-category; `data_type: fixture` → `Entries`; breeding-tagged stories →
`Breeding`; general news → `News`).

### 12.2 Tags

Tags include the story's byline author as one of the applied tags on every
generated draft (not a separate author field), matching the live site's
existing author-archive pattern at `harnesslink.com/tag/{author-slug}/`.
Topical tags from the template/generator are added alongside it.

### 12.3 Story-type templates

One template per `story_type`: `news`, `preview`, `result`, `feature`,
`breeding`, `industry`. Templates are stored as data (CPT or options-table
structure), never hardcoded into a prompt string, so an editor can change
one without a code deploy. Each template stores: target word count,
structure order, headline formula, default category (§12.1), default tags
(§12.2), whether/where a source_credit line is required, and an
`is_premium` default.

Concrete rules for the two templates with real worked examples:

**Result**
- Horse's first mention formatted as `Name (**Sire**)`
- Chronological race narrative: draw → early pace → mid-race moves →
  margin/time → any record broken
- Extended quotes flagged for bold-italic pull-quote treatment
- Closes with a link-out to the governing body's official results page
- `source_credit` **required**
- Byline case: capitalized "By"

**Feature**
- Opens with a framing sentence before biographical detail
- Long-form chronological structure
- Extended first-person quotes
- `source_credit` **not required** (original interview-based reporting)
- Byline case: lowercase "by"

**Preview**
- Opens with an image + caption line
- Leads with an insider quote before any facts
- Historical-context paragraph, then barrier-draw/field breakdown
- `source_credit` requirement not yet decided — template-level toggle,
  **default required**, flagged `[CONFIRM]` rather than assumed either way

**News / Breeding / Industry** — **[CONFIRM: no worked example was
provided for these three; Phase 5 should seed them with the same schema
(word count, structure order, headline formula, category/tag defaults,
source_credit toggle, is_premium default) using placeholder structure
orders until editorial supplies real examples, rather than inventing
house-style rules for them.]**

Every generated draft records which template version produced it.

---

## 13. Media & rights

Images/video are never auto-embedded without a confirmed `rights_holder` +
`rights_confirmed` pair (Hard Requirement 9). This applies uniformly
across intake channels, including images sourced from verified-social
posts (§3.4/§2.3) — appearing on a verified account does not itself
satisfy `rights_confirmed` if the image is a repost of a third party's
photo (an `agency_flagged` state applies until a human confirms rights).

---

## 14. Format outputs / repurposing

The story generator (§4's `format_outputs`, Phase 5) produces, per
candidate:

| Output | Description |
|---|---|
| `brief` | 100–150 words |
| `feature` | Full house-style article per the matched template (§12.3) |
| `social_snippet` | Short, carries the story's own link |
| `summary` | Internal only, never published — for editorial awareness of longer source material (e.g. a stewards report) without republishing it |

Plus 2–3 headline alternatives per draft, checked against house-style
rules (length, no clickbait, entity-first where the template calls for
it), and a `quality_score` based on names/dates/results present and
correct, template adherence, headline strength, and any QC flags raised.

---

## 15. Trending-topics signal

A separate, broader X scan (not limited to the §2.3 allow-list) whose only
job is detecting that a horse/trainer/race is getting unusual attention
right now. This is a signal, not a source: it writes only to the
`trending_signal` field on an existing Story Candidate, or to the Trending
Story Feed ranking (§5) — it never creates a new Story Candidate, and
never supplies a quote or a fact. A trending signal is never treated as
citable (Hard Requirement 9).

---

## 16. Attribution & byline policy

Every generated draft carries a non-removable `source_credit` meta field,
kept distinct from `byline`. `source_credit` is populated from the
matched Source Registry entry at intake time (§3) and records where the
underlying facts came from — it is never used to imply the source wrote
the piece.

`byline` defaults to the `hln_default_byline` setting ("HarnessLink
Media"), stored per-post, overridable by a human via a Published-By field
(`_hln_guest_author`) at review time (§18). Byline is never set to the
original source's name — HarnessLink Newsroom does not replicate the
legacy plugin's byline-overwrite behavior under any circumstance.

---

## 17. Outbound syndication

Three stub capabilities, all disabled by default (no partner integrations
exist yet):

- **Partner push** — webhook call carrying the structured package +
  `format_outputs` on publish.
- **Governing-body distribution** — pushing the `brief` format back to a
  body's own news page.
- **Social auto-post** — pushing `social_snippet` to HarnessLink's own
  accounts on publish. Distinct from §3.4's read-only monitoring of other
  accounts.

---

## 18. Editorial review workflow

Dashboard columns: **Incoming → Recommended → Building → Ready for Review
→ Changes Required → Published**.

- Incoming/Recommended are populated from the Trending Story Feed (§5),
  sorted by score, filterable by region.
- A candidate moves to Building when draft generation is triggered, and to
  Ready for Review once generation completes and quality_score/QC checks
  have run.
- Anything failing quality_score/QC lands directly in Changes Required
  with the specific issue named (e.g. "missing driver name," "unverifiable
  claim: no matching official-body record," "style violation: quote
  exceeds template length") — never a generic "needs work" label.

Single review screen per story — one story, one screen, no multi-step
approval chain. Shows: the draft (feature `format_output` primary, with
brief/social_snippet/summary as tabs or a secondary panel), source
link(s), image/video with `rights_confirmed` status visible, quality_score,
QC flags, and the tags/category field (pre-filled from the template
default, editable, author tag already applied per §12.2).

Three actions only: **Edit inline, Publish, Reject**.

- Publish is disabled until tags/category are confirmed (even if
  unchanged from the pre-fill).
- For any candidate flagged `requires_source_clearance`, Publish stays
  disabled entirely, regardless of reviewer action (Hard Requirement 11).
- Publish creates/updates a standard WP post with status `pending` —
  never `publish` directly. A second, explicit "Go live" action (or the
  existing WP editorial process) governs the final pending → live
  transition. This plugin's Publish action means "send to WordPress for
  final go-live," not "make it live on the site."
- Publish assigns category, tags (incl. author tag), byline meta
  (`_hln_guest_author`), and the non-removable `source_credit` meta.

---

## 19. Public API — auth & rate limiting (deferred)

Deprioritised until there is an actual partner to integrate with. Phase 7
ships the public API stubs (§7.3) without auth or rate-limiting, marked in
code with a plain engineering TODO comment — not a promise of when it will
be built, just a marker that it's intentionally deferred scope.
