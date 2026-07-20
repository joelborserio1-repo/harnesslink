# Building Harnesslink with Claude Code — Setup & Sequencing

---

## Part 1 — Repository structure

```
harnesslink/
├── api/                    # Rails 8 — API, admin, jobs
│   ├── CLAUDE.md
│   └── .claude/
│       ├── settings.json           # hooks
│       └── agents/                 # subagents
├── web/                    # Next.js 15 — public site
│   ├── CLAUDE.md
│   └── .claude/
├── migration/              # WordPress → Rails toolkit (throwaway after cutover)
│   └── CLAUDE.md
├── infra/                  # Kamal config, Terraform, docker
└── CLAUDE.md               # root: shared conventions, architecture overview
```

Run Claude Code sessions from `api/`, `web/`, or `migration/` — not the root — so it loads the narrow context. Keep the root CLAUDE.md short: architecture diagram, repo map, and the cross-cutting rules.

---

## Part 2 — Root `CLAUDE.md` starter

Copy this, then edit. It will be wrong in places — that's expected. Update it every time you find yourself correcting Claude twice on the same thing.

````markdown
# Harnesslink

Harness racing news publication. Replacing a WordPress site with ~100k articles,
~200k images, and existing search rankings we cannot afford to lose.

## Architecture

- `api/`       Rails 8, Postgres 16, Sidekiq, Redis. JSON API + editorial admin.
- `web/`       Next.js 15 (App Router), React 19, Tailwind. Public site. SSG/ISR.
- `migration/` One-off WordPress extraction and transformation. Deleted post-cutover.
- `infra/`     Kamal 2 deploy config, Cloudflare, R2.

Data flows one way: WordPress → migration → Rails → API → Next.js.

## Non-negotiable rules

1. **Never write to the production database.** Not in a script, not in a console,
   not "just to check". Read-only credentials only in any tooling.
2. **Every article URL from the old site must resolve.** Any change touching
   routing or slugs requires a corresponding Redirect record and a test.
3. **SEO metadata is load-bearing.** Titles, descriptions, canonicals, OG tags,
   and NewsArticle schema ship with every template. No template is "done"
   without them.
4. **No N+1 queries.** We have 100k articles. Use `includes`, add the index,
   and add a Bullet assertion in the test.
5. **Never delete or overwrite media assets.** Migration is additive only.
6. **Migrations must be reversible and resumable.** They will fail partway
   through. Design for restart from a checkpoint.

## Conventions

- Ruby: standard Rails idioms, RuboCop (rails-omakase). Service objects in
  `app/services/` for anything with more than one side effect.
- Tests: Minitest, fixtures not factories. Every model gets tests; every
  controller gets a request spec. Migration code gets tests against real
  sample data from `migration/fixtures/`.
- TypeScript strict mode in `web/`. No `any`.
- Commits: conventional commits (`feat:`, `fix:`, `chore:`).
- Never commit secrets. Rails credentials for the API, `.env.local` for web.

## Domain vocabulary

- **Article** — a published news story. Formerly a WordPress "post".
- **Author** — a bylined contributor (Adam Hamilton, Tony Milanese, etc.).
  Distinct from **User**, which is a login account.
- **Country** — top-level geographic taxonomy driving the nav
  (Australia, New Zealand, USA, Canada, Europe, UK/IRE).
- **The Insider** — the weekly Thursday subscriber newsletter.
- **Zone** — an ad placement position on a page.
- **legacy_wp_id / legacy_url** — provenance fields. Never null them, never
  reuse them, they are how we prove the migration was complete.

## What I want from you

- Ask before introducing a new dependency. We are deliberately conservative.
- Prefer boring, well-documented solutions over clever ones.
- If a task touches migration correctness, SEO, or payments: propose the plan
  and stop. Do not implement until I've approved the approach.
- When you're uncertain about WordPress content structure, inspect real data in
  `migration/fixtures/` rather than assuming.
````

---

## Part 3 — Hooks worth setting up on day one

In `api/.claude/settings.json`:

- **PostToolUse on file edits** → run `rubocop -a` on the changed file, then the relevant test file. Catches drift immediately instead of at review.
- **PreToolUse on Bash** → block any command containing production database hostnames, `rails db:drop`, `db:reset`, or `TRUNCATE`. This is the guardrail that matters most.
- **SessionStart** → print current branch, migration status, and whether there are pending schema changes.

In `web/.claude/settings.json`:

- **PostToolUse** → `tsc --noEmit` and `eslint --fix` on changed files.
- **PostToolUse on page/template files** → run the Lighthouse CI check against a local build. SEO regressions get caught by a machine, not by you in three months.

---

## Part 4 — Subagents worth defining

Put these in `.claude/agents/`. Each gets its own context window, so they don't pollute your main session.

| Subagent | Purpose |
|---|---|
| `wp-content-analyst` | Reads sample WordPress post HTML, identifies shortcodes/blocks/embed patterns, reports what the transformer needs to handle. Runs against real fixtures. Read-only. |
| `migration-verifier` | Given a batch of imported articles, compares field-by-field against source data and reports discrepancies. Never writes. |
| `seo-reviewer` | Reviews any new Next.js template for metadata completeness, schema markup, heading hierarchy, and image alt coverage. |
| `n1-hunter` | Audits new queries and controller actions for N+1 problems and missing indexes. |

---

## Part 5 — Build sequence (Claude Code milestones)

Work in this order. Each milestone should end with something demonstrable and tested.

### Milestone 1 — Foundations (week 1–2)
- `rails new api --api --database=postgresql`, Kamal config, CI pipeline
- Core schema: Article, Author, Category, Tag, Country, MediaAsset, Redirect
- Media pipeline: Active Storage → Cloudflare R2, variant generation
- Auth for admin users, role model
- **Deliverable:** you can create an article via console and retrieve it via API

### Milestone 2 — Content analysis (week 2–3, parallel)
- Export 500 representative WordPress posts across all years into `migration/fixtures/`
- Run `wp-content-analyst` over them; catalogue every shortcode, block type, and embed pattern
- **Deliverable:** a documented list of every content pattern the transformer must handle. This document is the actual spec for milestone 5, and skipping it is why migrations fail.

### Milestone 3 — Editorial admin (week 3–7)
- Article CRUD, TipTap editor, autosave, revisions
- Media library with search, drag-drop upload, alt/credit fields
- Workflow: draft → review → scheduled → published
- Roles and permissions
- **Deliverable:** Adam can write and publish a real article. Get him to actually try it — this is your first real feedback and it will surface things no spec captured.

### Milestone 4 — Public site (week 5–10)
- Next.js scaffold, header/footer rebuilt to match live site pixel-for-pixel
- Article, category, author, country templates
- SEO: metadata, NewsArticle schema, sitemaps (including Google News sitemap), RSS
- Typesense search
- Visual regression tests against the current live site
- **Deliverable:** new site running on staging, serving migrated sample content

### Milestone 5 — Migration engine (week 7–13)
- Extractor (WP REST API, resumable, checkpointed)
- HTML → TipTap transformer, driven by the milestone 2 catalogue
- Media migration to R2
- Redirect map generation
- `migration-verifier` runs on every batch
- **Run the full import at least three times on staging before you trust it.**
- **Deliverable:** complete content set on staging, verified, with a full redirect map

### Milestone 6 — Commercial systems (week 10–15)
- Ad zones and house-ad model; Broadstreet/GAM integration
- Stripe + entitlements to replace Leaky Paywall — **plan this with a human, not an agent**
- Subscriber migration (highest risk in the project)
- Newsletter integration
- Social publishing via n8n or Buffer, with `SocialPost` records
- Comments migration or replacement

### Milestone 7 — Cutover (week 14–17)
- Parallel run, minimum two weeks
- Crawl diff: every old URL vs new
- Search Console baseline captured before switching
- Contributor training
- DNS cutover on your quietest day, with a rollback that's a DNS change

---

## Part 6 — Things to explicitly not delegate

Be deliberate about these. Claude Code will happily attempt all of them; the failure modes are expensive and quiet.

1. **Stripe/subscriber migration.** Real money, real customers. Human-planned, human-verified, tested against a Stripe test account with a copy of real data.
2. **The final production import.** Supervised, run once, verified against a checklist you wrote in advance.
3. **DNS cutover.** Obviously.
4. **Deciding what "matching the old design" means.** Get sign-off on screenshots, not on descriptions.
5. **Judging whether an article rendered correctly.** Automated diffs catch structural breakage; they don't catch a pull quote that's now in the wrong place. Someone reads a sample by eye.

---

## Part 7 — First three prompts to run

Once the repos exist:

**1. In `migration/`:**
> Read the sample WordPress posts in `fixtures/`. Catalogue every distinct content pattern you find — shortcodes, Gutenberg blocks, Elementor output, embed types, inline image markup, and anything malformed. Output a markdown table of pattern → frequency → proposed handling. Don't write transformer code yet.

**2. In `api/`:**
> Set up the Rails 8 API skeleton per the CLAUDE.md architecture. Postgres, Sidekiq, Kamal config, CI running RuboCop and Minitest. Then implement the Article, Author, Category, Tag, and Country models with migrations, validations, and tests. Include `legacy_wp_id` and `legacy_url` on Article with unique indexes. Propose the schema before writing it.

**3. In `web/`:**
> Set up Next.js 15 with App Router, TypeScript strict, and Tailwind. Then rebuild the Harnesslink header and footer as components matching the reference screenshots in `reference/`. Nav structure should be data-driven, not hardcoded. Include a Playwright visual regression test comparing against the reference images.
