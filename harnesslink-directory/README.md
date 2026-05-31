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
    ├── stallion-profile.php        # Generic listing profile page
    └── partials/
        ├── listing-row.php         # Generic table row (shared by PHP + AJAX)
        └── category-nav.php        # Front-end category navigation
```

## Notes for developers

- The listings table is still `{$prefix}hld_stallions` (kept for
  back-compat); a `directory_type` column scopes every row to its category.
- `HLD_DB::get_listings()` is the generic, type-aware query;
  `HLD_DB::get_stallions()` is a thin wrapper that scopes to `stallion`.
- All front-end markup is wrapped in `.hl-directory` (aka
  `.harnesslink-directory`). Theme button overrides are scoped to that
  wrapper only — global site buttons are never touched.
