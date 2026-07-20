# Harnesslink

Harness racing news publication, replacing a WordPress site with **62,558
published articles**, ~132k media assets, and existing search rankings we
cannot afford to lose. SEO parity is the acceptance criterion for the whole
project — see `BUILD_V1.md`.

## Source-of-truth docs (read these first)

Precedence when they conflict is defined in `docs/README.md`:
1. `BUILD_V1.md` — the operative spec (Steps 0–10, acceptance criteria).
2. `migration/DISCOVERED_FACTS.md` — ground truth from the live DB.
3. `docs/CLAUDE_CODE_SETUP.md`, `docs/PLATFORM_PLAN.md` — reference.

## Repo map

- `api/`        Rails 8 API + editorial admin + jobs. Postgres 16.
- `web/`        Next.js 15 public site (not scaffolded yet).
- `migration/`  WordPress recon + (later) importer. Throwaway after cutover.
- `docs/`       Plans and reconciliation notes.

Data flows one way: WordPress → migration → Rails → API → Next.js.

## Non-negotiable rules

1. **Never write to the production WordPress database.** Read-only creds only.
2. **Every existing article URL must resolve at the SAME path.** The live
   permalink structure is **`/%postname%/`** — flat, root-level slugs. Anything
   touching routing/slugs needs a test.
3. **SEO metadata is load-bearing.** Rank Math titles/descriptions/canonicals/OG
   + `NewsArticle` JSON-LD ship with every template.
4. **Legacy article HTML is preserved verbatim** (`body_format: legacy_html`).
   Do NOT convert 100k legacy articles to TipTap JSON.
5. **No N+1 on 60k+ rows.** Use `includes`, add the index.
6. **Migrations are additive, reversible, resumable.**
7. **Propose before implementing** anything touching routing, slugs, metadata,
   or the importer. Ask before adding a dependency.

## Local dev (this environment)

- Ruby via rbenv: `export PATH=/opt/rbenv/versions/3.3.6/bin:$PATH`
- Postgres 16: `pg_ctlcluster 16 main start`. Dev role `harnesslink` / password
  `harnesslink` (superuser in dev so Rails fixtures can disable FK checks).
- Redis 7 available. Rails 8 ships **Solid Queue/Solid Cache** (DB-backed) by
  default — see the open question about Sidekiq in the build notes.
- `cd api && bin/rails db:prepare && bin/rails test`

## Domain vocabulary

- **Article** — a published news story (WordPress "post").
- **Author** — a bylined contributor. Distinct from **User** (a login account).
  The live site has overlapping author systems (Molongui, PublishPress, WP
  users, author tags); `Author#legacy_refs` captures all of them.
- **Category** — geographic (USA, NZ, Australia…) or editorial (Top 4, Blog).
  Archive URLs are category archives.
- **Country** — the "Explore by Countries" nav; points at geographic categories.
- **legacy_wp_id / legacy_url** — provenance. Never null for migrated content,
  never reuse. They prove the migration was complete.
