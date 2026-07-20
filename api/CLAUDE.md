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

- Auth: `User` has a `password_digest` column but `has_secure_password` is
  deferred pending the **bcrypt** dependency (needs sign-off).
- API controllers, routing (the `/%postname%/` resolver), Redirect middleware,
  the SEO parity harness, and the importer — all still to come per BUILD_V1.
