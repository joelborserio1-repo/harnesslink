# Harnesslink — source-of-truth docs & precedence

These documents drive the v1 rebuild. When they disagree, follow this order
(most authoritative first). This file exists so a narrow-context session doesn't
follow superseded advice.

| Rank | Doc | Role |
|---|---|---|
| 1 | [`/BUILD_V1.md`](../BUILD_V1.md) | **The operative spec.** Steps 0–10 with acceptance criteria. This is what we build. |
| 2 | [`/migration/DISCOVERED_FACTS.md`](../migration/DISCOVERED_FACTS.md) | **Ground truth** about the actual WordPress install (verified against the live DB). Overrides any assumption anywhere else. Keep it updated as recon fills gaps. |
| 3 | [`CLAUDE_CODE_SETUP.md`](./CLAUDE_CODE_SETUP.md) | Sequencing, repo structure, subagents, hooks. Meta-guidance on *how* to build. |
| 4 | [`PLATFORM_PLAN.md`](./PLATFORM_PLAN.md) | Earlier consultative architecture plan. Broad context and rationale, but **superseded by BUILD_V1 wherever they conflict** (see below). |

## Reconciliation — where the earlier docs conflict with BUILD_V1

`PLATFORM_PLAN.md` and `CLAUDE_CODE_SETUP.md` predate the v1 constraints. Where
they differ, **BUILD_V1.md wins**:

| Topic | Earlier docs say | v1 decision (BUILD_V1) |
|---|---|---|
| Search | Typesense (or Meilisearch) | **Postgres full-text + `pg_trgm`. No search server in v1.** |
| Article body | Store as structured JSON (single source) | **`body_format` enum. Legacy stays `legacy_html`, byte-preserved. Do NOT convert 100k articles to JSON.** New articles = `tiptap_json`. |
| Next.js hosting | Vercel (start) or self-host | **Self-hosted.** No Vercel dependency. |
| Object storage | Cloudflare R2 | **MinIO / local volume in dev; object storage in prod.** imgproxy for resizing. |
| Admin framework | Avo (commercial) floated | **Free/OSS only. No commercial admin frameworks.** |
| Error tracking | Sentry | **GlitchTip (Sentry-compatible, OSS).** |
| Ads / paywall / newsletter / comments / Directory / reader accounts | Treated as workstreams | **Explicitly OUT of v1 scope.** Design so they can be added later; build none now. |

## Fact corrections carried by DISCOVERED_FACTS

- "~100,000 published articles" (brief) → **62,558 published posts**. The ~100k
  figure is total rows including 26,638 drafts and 41,743 revisions.
- Table prefix is **`wzev_`**, not `wp_`.
- Bylines are a **custom post type** (`guest_author`, Co-Authors Plus), not just
  `wzev_users`.

## Still blocking (answer before Step 3 / schema)

The #1 unknown is the **exact permalink structure** — it determines all routing
and is the linchpin of the SEO-parity constraint. `migration/recon.rb` §1
captures it. See `DISCOVERED_FACTS.md` "Open questions" for the full list.
