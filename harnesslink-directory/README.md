# HarnessLink Directory — WordPress Plugin

> **v1.2.0** evolves the plugin from a stallion-only directory into a
> **scalable multi-category directory**. Every listing belongs to a
> *directory type* (stallion, trainer, driver, agistment, transport, vet,
> feed & supplements, bloodstock, syndicator, breaking/pre-training,
> industry service — and any custom type you add). All categories share one
> unified set of templates, queries, styles and shortcodes.

## Installation

1. Upload the `harnesslink-directory` folder to `/wp-content/plugins/`
2. Activate the plugin via **Plugins → Installed Plugins** in WordPress admin
3. The plugin will automatically create the `hld_stallions` database table on activation
4. After activation, go to **Settings → Permalinks** and click **Save Changes** to flush rewrite rules

---

## Setup

### Create the Directory Page
1. Go to **Pages → Add New**
2. Title it **Directory** (or anything you prefer)
3. Add this shortcode to the page body:
   ```
   [harnesslink_directory]
   ```
4. Publish the page
5. Go to **HarnessLink → Settings** and select this page as the Directory Page

### Permalink Structure
The plugin registers these URLs automatically:
- `/directory/` — Main directory hub
- `/directory/stallions/{id}/stallion-name` — Internal stallion profile page

> **Important:** If profiles return 404, go to Settings → Permalinks and click Save Changes.

---

## Admin Dashboard

Navigate to **HarnessLink** in the WordPress admin sidebar.

### Stallions
- View all listings with stats (total, paying, by type)
- Search by name, stud, country
- **Add Stallion** — opens a modal with three tabs:
  - **Basic Info** — name, stud, country, region, type, paying status
  - **Contact Details** — phone, email, website, address (paying only)
  - **Profile & Racing** — bio, profile pic URL, race record, progeny
- **Edit** — loads existing data into the modal
- **Delete** — with confirmation prompt

### Import CSV
- Drag & drop or browse for a `.csv` file
- Click **Import CSV** to bulk-insert stallions
- Download the **sample CSV** to see the expected column format
- Accepted column names (flexible):
  - `name` (required)
  - `stud` or `stud_name`
  - `country`, `region`
  - `stud_master`
  - `type` (Pacer or Trotter)
  - `status_note` or `status`
  - `is_paying` (1, yes, true, or y)
  - `phone`, `email`, `website`, `address`
  - `bio`, `race_record`, `progeny`

### Settings
- Link the directory shortcode page
- Set accent colour for public-facing UI

---

## Paying vs Free Listings

| Feature                  | Free Listing | Paying Stud |
|--------------------------|:------------:|:-----------:|
| Listed in directory      | ✓            | ✓           |
| Name displayed           | ✓ (no link)  | ✓ (linked)  |
| View Profile link        | ~~crossed~~  | ✓ active    |
| Profile / contact links   | Struck through | ✓ active |
| Internal profile page    | —            | ✓           |
| Contact info visible     | —            | ✓           |
| Bio, race record, fee    | —            | ✓           |

---

## Shortcodes

| Shortcode                                   | Description                                                        |
|---------------------------------------------|--------------------------------------------------------------------|
| `[harnesslink_directory]`                   | Full directory hub with category nav, search & listings (Stallions) |
| `[harnesslink_directory type="trainer"]`    | Opens the directory on a specific category (any registered slug)    |
| `[harnesslink_directory nav="false"]`       | Same, but hides the category navigation bar                         |
| `[harnesslink_stallion id="42"]`            | Single listing profile card on any page                            |

Recognised type slugs out of the box: `stallion`, `trainer`, `driver`,
`agistment`, `transport`, `vet`, `feed-supplements`, `bloodstock`,
`syndicator`, `pre-training`, `industry-service` — plus any you create.

Each type also has its own archive at **`/directory/{slug}/`** (e.g.
`/directory/transport/`) and profile URLs at
`/directory/{slug}/{id}/{name}`. Legacy `/directory/stallions/{id}/…`
links keep working.

---

## Member Access (front-end login — no Ultimate Member)

The directory gates profile pages and contact details behind a login. This is
handled entirely by the **WordPress core user system** via the built-in
`HLD_Auth` module — there is **no dependency on Ultimate Member** or any other
membership plugin. (If UM happens to still be active its login page is used as
a legacy fallback, but it is no longer required.)

### Setup
1. Create three pages and drop one shortcode on each:
   - **Login** → `[harnesslink_login]`
   - **Register** → `[harnesslink_register]`
   - **Reset Password** → `[harnesslink_reset]`
2. Go to **HarnessLink → Settings → Member Access** and select those pages,
   choose the **New Member Role** (default *Subscriber*), and toggle
   **Allow self-registration**.
3. Optionally place `[harnesslink_account]` in a header/menu for a
   "logged in as… / Log out" control.

### What it does
- Branded, navy/white login, registration and password-reset forms (scoped to
  `.hl-directory`, so they match the directory and never touch global styles).
- Built on core: `wp_signon()`, `wp_insert_user()`, `get_password_reset_key()`
  / `reset_password()`, nonces and core session cookies.
- Self-registered members get the configured role and are logged straight in.
- Non-admin members are redirected away from `wp-admin` and the admin toolbar
  is hidden for them — they live entirely on the front-end.
- Any logged-in user can view profiles & contact details; guests see
  "Login to View".
- **Anti-bot honeypot** on the login, registration and password-reset forms:
  a decoy field hidden from humans (off-screen + `aria-hidden`) plus a
  submission-timing trap. Bots that fill the decoy or submit in under
  3 seconds are silently dropped and shown a neutral notice — no signal that
  they were caught. Degrades gracefully if the timing token is missing.

### Shortcodes
| Shortcode | Purpose |
|---|---|
| `[harnesslink_login]` | Login form (links to register / reset) |
| `[harnesslink_register]` | Self-registration form |
| `[harnesslink_reset]` | Lost-password request + set-new-password |
| `[harnesslink_account]` | "Logged in as… / Log out" panel |

---

## Directory Types (adding new categories)

Categories are managed entirely from the admin — **no code required**.

1. Go to **HarnessLink → Directory Types**
2. Click **+ Add Directory Type**
3. Fill in:
   - **Slug** — used in URLs & shortcodes (lowercase, dashes)
   - **Singular / Plural labels**
   - **Name / Organisation column headers** (e.g. "Business" / "Operator")
   - **Icon initials**, **tagline**, **coming-soon description**
   - **Visible** toggle and optional **Gait column** (Pacer/Trotter)
4. **Save**, then visit **Settings → Permalinks → Save Changes** once so the
   new archive URL is recognised.

Built-in types can be edited or hidden but not deleted (their slug is
referenced by existing listings). Custom types can be deleted.

A category with **no listings yet** automatically shows a polished, branded
**“coming soon”** empty state with a *Contact HarnessLink* call to action.

### Per-category fields

Each directory type captures its own fields. Stallions keep their full
bespoke schema (stud, gait, regional contacts, race record, progeny…).
Every other type uses a streamlined **service** schema, and the add/edit
form adapts automatically — stallion-only fields are hidden and labels
adjust (e.g. Region → State):

| Category | Fields |
|---|---|
| Trainers / Drivers / Breaking & Pre-Training | Name, Phone, Email, Suburb, State, Country |
| Syndicators / Bloodstock / Agistment | + Website |
| Equine Transport | + Website, **Routes Travelled** |
| Veterinary Services | + Website, **Locations Covered** |
| Feed & Supplements | + Website, **Delivery Locations** |
| Equine Businesses & Industry Services | + **Industry Involvement**, Delivery Locations |

On the service category pages the listing table shows **Name + Location
(Suburb · State · Country) + Profile + Contact**; the full contact details
appear on the profile page (gated to paid listings). CSV import recognises
`suburb`/`town`/`city`, `state`, `industry`, and
`coverage`/`routes`/`locations_covered`/`delivery_locations` columns.

---

## File Structure

```
harnesslink-directory/
├── harnesslink-directory.php       # Plugin bootstrap
├── README.md
├── includes/
│   ├── class-hld-types.php         # Directory Types registry (categories)
│   ├── class-hld-db.php            # Database layer (type-aware CRUD + queries)
│   ├── class-hld-post-types.php    # Type-aware rewrite rules + URL helpers
│   ├── class-hld-shortcodes.php    # [harnesslink_directory type="…"]
│   └── class-hld-ajax.php          # AJAX: search, save, delete, CSV import
├── admin/
│   ├── class-hld-admin.php         # Admin menu + asset registration
│   ├── css/hld-admin.css           # Admin dashboard styles
│   ├── js/hld-admin.js             # Modal, CRUD, CSV import JS
│   └── views/
│       ├── stallions.php           # Listings list + add/edit modal (type-aware)
│       ├── types.php               # Directory Types manager (add/edit/delete)
│       ├── import.php              # CSV import page (per-type)
│       ├── enquiries.php           # Listing enquiries inbox
│       └── settings.php            # Plugin settings
├── public/
│   ├── css/hld-public.css          # Directory + profile styles (scoped .hl-directory)
│   └── js/hld-public.js            # Live search, filter, claim, enquiry modal
└── templates/
    ├── directory-page.php          # Generic directory template (any type)
    ├── stallion-profile.php        # Entry point: login gate + breadcrumb, then branches by layout
    └── partials/
        ├── listing-row.php         # Generic table row (shared by PHP + AJAX)
        ├── category-nav.php        # Front-end category navigation
        ├── horse-profile.php       # Redesigned stallion/horse profile body (layout === 'stallion')
        └── service-profile.php     # Unchanged profile body for trainers/vets/etc. (layout === 'service')
```

## Notes for developers

- The listings table is still `{$prefix}hld_stallions` (kept for
  back-compat); a `directory_type` column scopes every row to its category.
- `HLD_DB::get_listings()` is the generic, type-aware query;
  `HLD_DB::get_stallions()` is a thin wrapper that scopes to `stallion`.
- All front-end markup is wrapped in `.hl-directory` (aka
  `.harnesslink-directory`). Theme button overrides are scoped to that
  wrapper only — global site buttons are never touched.

---

## Horse / Stallion Profile Redesign (v1.7.1)

The individual stallion profile (`/directory/stallion/{id}/{name}`) was
rebuilt to a richer, HarnessLink-branded layout: hero photo carousel,
structured three-generation pedigree, a promotional banner, "About" +
"Crosses of Gold" content, videos, and related stallions. **No new
framework was introduced** — this extends the existing custom-table +
virtual-URL architecture the plugin already uses (there is no ACF, Meta
Box, or custom post type in this codebase; every listing across every
category lives in one `{$prefix}hld_stallions` row). Only stallion-layout
listings (`directory_type = 'stallion'` with `supports_gait` on) get the
new template — trainers, vets, agistment, etc. keep their existing profile
layout unchanged (`templates/partials/service-profile.php`, byte-for-byte
the pre-redesign markup).

### What changed structurally

- **New columns on `hld_stallions`** (added additively via
  `HLD_DB::ensure_columns()` — nothing existing was renamed, dropped, or
  backfilled): `tagline`, `short_summary`, `year_of_birth`, `colour`,
  `sex`, `booking_url`, `booking_label`, `hero_image_id`, `crosses_intro`,
  `related_ids`, and 14 pedigree fields (`ped_sire`, `ped_dam`,
  `ped_ss`/`ped_sd`/`ped_ds`/`ped_dd`, and 8 great-grandparent fields
  `ped_sss` … `ped_ddd`). Each pedigree field stores `"Name"` or
  `"Name\nRecord"` (a second line for a race record like `p,3,1:50`) —
  still a single plain-text column, just multi-line.
- **New `description` column on `hld_gallery`** — used for video
  descriptions (the existing `caption` column doubles as the video title).
  The Images tab and Media tab are two views over the *same* gallery table,
  filtered by `media_type`.
- **New `hld_crosses` table** — repeatable "Crosses of Gold" entries
  (title, description, examples, drag-to-reorder), following the same
  pattern as the existing `hld_progeny` and `hld_gallery` child tables.
- **New `hld_banners` table** — the promotional banner is a repeatable,
  rotating set of images (each with its own link, alt text, and optional
  on/off dates), not a single field. Recommended image size is
  **1360 × 150px**. It renders full-width directly above "About the
  Horse". One active banner shows statically; two or more auto-rotate
  (6s interval, pauses on hover/focus, dot navigation) via
  `HLD_DB::get_active_banners()`, which filters to banners that have an
  image and, if dated, fall inside their start/end window.
- **Related horses** are stored as a JSON array of listing IDs in
  `related_ids` — a lightweight many-to-many without a join table, resolved
  at render time via `HLD_DB::get_related_listings()`.
- Deleting a stallion now also cleans up its gallery, progeny, crosses and
  banner rows (`HLD_DB::delete_stallion()`) — previously these were
  orphaned.
- Fixed a pre-existing bug where saving a gallery item's caption reset its
  `sort_order` to 0, silently undoing drag-reordering.
- Pedigree boxes are branded in the site's navy palette (solid navy fill,
  white name, light-blue record line) rather than plain bordered white
  cells, with the horse's own box emphasised. **No pedigree image/screenshot
  upload was added** — that would require a paid third-party AI vision API
  to extract table data from a photo reliably, which is a real cost/data-
  privacy decision that needs sign-off, not something to wire in silently.
  Instead there's a "Quick Fill from Pasted Text" tool on the Pedigree tab:
  it hands you a bracket-labelled template (`[Sire]`, `[Dam]`, …), you fill
  each one in from whatever source you already have (a website, a
  spreadsheet) and paste the whole block back — it parses instantly,
  client-side, into the 14 structured fields.

### Admin — editing a horse (for Bev)

Open **HarnessLink → Stallions → Add/Edit Stallion**. For a `stallion`
directory-type listing the modal now has these tabs:

1. **Overview** — name, tagline, short summary, year of birth, colour, sex,
   standing farm, service fee, booking button label/URL, paying/featured
   toggles.
2. **Contact Details** — unchanged.
3. **Profile & Racing** — "About the Horse" (Profile Bio), legacy Profile
   Picture URL (only used if no Hero Image is set below), race record.
4. **Images** — Hero Image (the large photo at the top), Gallery Images
   (carousel/thumbnails — upload or paste a URL, drag to reorder), and
   Promotional Banners (recommended **1360 × 150px**; add one for a static
   banner, or several to rotate automatically — each with its own link,
   open-in behaviour, alt text, and optional start/end dates).
5. **Pedigree** — a "Quick Fill from Pasted Text" tool at the top for fast
   bulk entry, plus 14 individual two-line boxes (name, optional race
   record) below it — Sire/Dam, the 4 grandparents, the 8
   great-grandparents. Leave any box blank to omit it cleanly — nothing
   blocks publishing.
6. **Content** — the "Crosses of Gold" intro paragraph plus one card per
   breeding cross (title, description, optional notable examples). Add,
   remove, and drag to reorder.
7. **Media** — videos: paste a YouTube/Vimeo link or upload a file, add a
   title and description per video. Hidden on the profile if empty.
8. **Related Horses** — type-ahead search to pick other stallions to
   feature; remove with the ✕ on a selected chip.
9. **Progeny** — unchanged (CSV import).

Every field is optional except Name — publishing is never blocked by
incomplete pedigree, banner, or other optional fields. Empty sections
(no gallery, no videos, no crosses, no banner, no related horses) simply
don't render on the profile.

### Migration / existing content

Nothing was deleted or renamed. Existing stallion listings keep working
exactly as before with zero admin action required:

- Their existing **Profile Picture URL** (`profile_image`) is used as the
  hero photo until a Hero Image is set — the carousel gracefully falls
  back to a single static image, then to the initials placeholder if
  neither is set.
- Their existing **Profile Bio** is used as "About the Horse" — same
  field, no re-entry needed.
- Pedigree, Crosses of Gold, banner, videos and related horses simply
  don't render until Bev fills them in — no placeholder text, no layout
  shift, no errors.
- URLs are unchanged (`/directory/stallion/{id}/{slug}`), so no redirects
  were needed and no SEO/indexing impact is expected.
- Trainers, drivers, vets and every other non-stallion category are
  visually and functionally untouched.

### Rollback

If a revert is needed: reactivate/redeploy the previous plugin version.
The new `hld_stallions`/`hld_gallery` columns and the `hld_crosses`/
`hld_banners` tables are purely additive, so the old code ignores them
safely — no destructive migration runs in either direction. No manual DB
cleanup is required to roll back; the new columns/tables can be left in
place harmlessly, or dropped manually later if desired.

### Test checklist

- [ ] Add a new stallion with only a Name — publishes, page renders with
      graceful empty states everywhere (no console errors, no PHP notices).
- [ ] Add Hero Image + several Gallery images — carousel shows thumbnails,
      arrow keys / swipe / prev-next buttons / thumbnail clicks all switch
      slides, clicking the main photo opens the full-size lightbox.
- [ ] Leave only one gallery image — carousel controls are hidden, single
      image displays cleanly.
- [ ] Fill in Sire/Dam only (no grandparents) — pedigree shows a 2-branch
      tree, no empty placeholder cells.
- [ ] Fill in the full 14-field pedigree, each with a name and a race
      record on the second line — three-generation tree renders with all
      15 branded navy boxes (horse + 14 ancestors) showing name + record,
      no horizontal page overflow on mobile (pedigree box scrolls
      internally).
- [ ] Pedigree Quick Fill: click "Get Template", fill in a few `[Label]`
      sections, paste back, click "Fill Fields" — the matching boxes
      populate and unmatched/blank sections are left alone.
- [ ] Add one banner image — shows statically, no dots/rotation.
- [ ] Add three banner images — they auto-rotate every ~6s, rotation
      pauses on hover/keyboard focus, clicking a dot jumps to that banner,
      reordering by dragging the thumbnail persists after reload.
- [ ] Add a banner with a start date in the future — that banner is
      skipped (not shown) until its date arrives; a banner with no image
      yet never appears.
- [ ] Add a YouTube link, a Vimeo link, and an uploaded video — all three
      embed and play correctly; Media section is hidden when no videos
      exist.
- [ ] Add 2 Crosses of Gold entries, reorder them, delete one — order and
      deletion persist after reload.
- [ ] Select 3 related horses — cards show image, name, descriptor, and
      link to the correct profile; unpublished/deleted related horses are
      skipped silently.
- [ ] Edit an existing (pre-redesign) stallion that only has the old
      Profile Picture URL and Profile Bio filled in — profile renders
      correctly with no new fields required.
- [ ] View a trainer/vet/agistment profile — confirm it is pixel-identical
      to before (uses `service-profile.php`, untouched).
- [ ] Confirm `/directory/stallion/{id}/{slug}` URLs are unchanged for
      existing listings.
- [ ] Mobile: hero image appears above the pedigree panel (not beside it);
      no page-level horizontal scroll anywhere on the profile.
