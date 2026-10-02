# api/ — Rails 8 backend

JSON API + editorial admin + background jobs for Harnesslink. See the root
`CLAUDE.md` and `../BUILD_V1.md` for the rules that govern this app.

## Conventions

- Rails 8, Postgres 16. Ruby idioms, rails-omakase RuboCop.
- Tests: **Minitest + fixtures** (not factories). Every model gets tests;
  every controller gets a request test.
- Service objects in `app/services/` for anything with more than one side effect.
- Enums are integer-backed with a prefix (`article.status_published?`).

## Schema (implemented — Step 3)

Core tables: `articles`, `authors`, `categories`, `tags`, `countries`,
`media_assets`, `redirects`, `users`, `article_revisions`, and the joins
`article_categories` / `article_tags` / `article_authors`.

Key article fields carrying the SEO/migration weight:
- `body_format` (legacy_html | tiptap_json) + `body_html` / `body_json`
- `slug` (unique, single path segment — the whole `/%postname%/` path)
- `legacy_wp_id`, `legacy_url` (unique; provenance)
- Rank Math SEO field set (`seo_title`, `seo_description`, `focus_keyword`,
  `canonical_url`, `robots`, OG/Twitter overrides, `schema_type`)
- indexes: slug, legacy_wp_id, legacy_url (unique); `published_at DESC`;
  `(primary_category_id, published_at)`; `status`

## Running

```
export PATH=/opt/rbenv/versions/3.3.6/bin:$PATH
bin/rails db:prepare
bin/rails test
bin/rails server
```

## Not yet done (next steps)

- Reader accounts: the registration wall signs readers up, but returning
  readers have no login yet (magic-link planned; `User` role `reader`).
- Avo (`/avo`) still signs in through Devise `AdminUser`; the editorial portal
  uses `User` (see "Staff accounts" below). Folding the two together is open.
- Advertiser billing / Xero, The Eureka partnership page, scheduled publishing
  job — see `../docs/PLATFORM_ASSESSMENT.md`.

## Staff accounts (editorial portal)

- Staff are `User` rows with role `contributor` (journalist), `editor` or
  `admin`, `has_secure_password`, and an `active` flag. Never delete a staff
  user — deactivate, so stories and revisions keep their owner.
- `POST /api/v1/admin/session` returns a token (`generates_token_for
  :staff_session`, 14 days, invalidated by a password change). Every
  `Api::V1::Admin` controller requires it as `Authorization: Bearer`.
- Roles are enforced in the API, not the UI: contributors see and edit only
  their own stories and can only set `draft` / `in_review`; editors publish and
  manage the directory; admins also manage ads and staff
  (`require_editor!` / `require_admin!` in `AdminAuthenticatable`).
- Each admin-API edit to title/body snapshots the previous version into
  `article_revisions`.
- Tests sign in with `staff_headers(users(:editor))`.
