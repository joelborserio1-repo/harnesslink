# Harnesslink Platform Rebuild — Architecture & Migration Plan

**Prepared:** 20 July 2026
**Current stack:** WordPress + Elementor + JNews theme, ~60 plugins, ~100k posts, ~200k images
**Proposed stack:** Ruby on Rails (API + admin) + React (Next.js public site) + Postgres + Cloudflare

---

## 0. Read this section before committing budget

Your symptoms — downtime, 404s, slow response, server overload — are real, but they are not evidence that WordPress can't handle your content volume. 100k posts is mid-sized. Publications with 500k+ posts run on WordPress comfortably.

The realistic causes, in order of likelihood:

| Cause | Why it produces your symptoms | Cost to fix in place |
|---|---|---|
| ~60 plugins, several doing overlapping work | Every request loads all of them; each adds queries and autoloaded options | 1–2 weeks audit + removal |
| Elementor rendering on the front end | Elementor page-builder output is heavy; on a news archive it's the wrong tool | 2–4 weeks (rebuild templates) |
| `wp_postmeta` / `wp_options` bloat, missing indexes | 100k posts × dozens of meta rows = millions of rows, unindexed lookups | Days |
| Post revisions never purged | Can triple your posts table | Hours |
| No object cache / no page cache at edge | Every reader hits PHP and MySQL | Days |
| 200k images served from origin, unoptimised | Bandwidth and I/O saturation | Days (move to CDN/R2) |
| Undersized or shared hosting | Everything above compounds | Hours |

**My recommendation:** run a two-week diagnostic and remediation sprint *first*, in parallel with scoping the rebuild. You will either (a) fix the problem for a few thousand dollars, or (b) prove conclusively that WordPress is the constraint, which makes the rebuild business case bulletproof rather than assumed.

Either way, the rebuild plan below stands. If you do rebuild, you want to do it because you want editorial control, speed, and a platform you own — not as an emergency fix. Rebuilds done in a panic ship late and buggy.

**Honest sizing of the rebuild:** 5–8 months with a competent two-person team, or 3–4 months with four people. Budget in the AU$120k–$300k range depending on how much you build vs. buy. Anyone quoting materially less has not understood the migration.

---

## 1. Target architecture

```
                        ┌─────────────────────────┐
                        │   Cloudflare (CDN/WAF)  │
                        └───────────┬─────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼────────┐  ┌─────────▼────────┐  ┌─────────▼────────┐
    │  Next.js (React) │  │  Rails Admin/CMS │  │  imgproxy / CF   │
    │  public site     │  │  editorial UI    │  │  Images          │
    │  ISR + SSG       │  │                  │  │                  │
    └─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘
              │                     │                     │
              └──────────┬──────────┘                     │
                         │                                │
                ┌────────▼─────────┐              ┌───────▼────────┐
                │  Rails API       │              │ Cloudflare R2  │
                │  (JSON, GraphQL  │              │ 200k+ images   │
                │   optional)      │              │                │
                └────────┬─────────┘              └────────────────┘
                         │
        ┌────────────────┼────────────────┬──────────────────┐
        │                │                │                  │
  ┌─────▼─────┐   ┌──────▼─────┐   ┌──────▼──────┐   ┌───────▼──────┐
  │ Postgres  │   │   Redis    │   │  Typesense  │   │ Sidekiq      │
  │ 16        │   │ cache/jobs │   │  search     │   │ background   │
  └───────────┘   └────────────┘   └─────────────┘   └──────────────┘
```

### Why this shape

- **Rails for the backend/CMS.** Mature, boring, excellent for content modelling and admin interfaces. Active Record handles your data model cleanly; Sidekiq handles publishing, social pushes, image processing, feed generation.
- **Next.js for the public site.** You are a news publisher: SEO is existential. A plain React SPA would be a disaster for Google News and organic search. Next.js gives you server rendering and incremental static regeneration — articles are pre-rendered and served from the edge in milliseconds, regenerating only when edited.
- **Postgres over MySQL.** Better full-text options, better JSON handling, better indexing for your archive.
- **Typesense for search.** Elasticsearch is more powerful and much more operational overhead. Typesense indexes 100k articles trivially, is fast, and is far cheaper to run. Meilisearch is an equally good alternative.
- **Cloudflare R2 for images.** Zero egress fees, which matters enormously at 200k images. Paired with imgproxy or Cloudflare Images for on-the-fly resizing and WebP/AVIF conversion.

### Deployment

- **Kamal 2** (Rails' own deploy tool) onto Hetzner or DigitalOcean dedicated instances. Predictable cost, no vendor lock-in.
- Managed Postgres (DigitalOcean, Crunchy, or RDS) — do not self-host your database.
- Next.js on Vercel *or* self-hosted alongside Rails. Vercel is easier; self-hosting is cheaper at scale. Start on Vercel, move later if the bill justifies it.
- Staging environment that mirrors production, with a sanitised database copy.

---

## 2. Content model

Mapped from your current WordPress structures.

```ruby
Article
  title, subtitle, slug, body (rich JSON), excerpt
  status: draft | in_review | scheduled | published | archived
  published_at, scheduled_for
  author_id (→ Author), secondary_byline (free text, e.g. "for Harness Racing NZ")
  featured_image_id, featured_image_caption, featured_image_credit
  reading_time, view_count
  seo_title, seo_description, canonical_url, og_image_id
  legacy_wp_id, legacy_url          # critical for migration + redirects
  paywalled: boolean, paywall_tier

Author            name, slug, bio, avatar, email, twitter, role
Category          name, slug, parent_id       # Australia, New Zealand, USA, Top 4…
Tag               name, slug
Country           name, slug                   # your "Explore by Countries" nav
MediaAsset        file, alt, caption, credit, width, height, blurhash, legacy_url
Redirect          from_path, to_path, status_code, hit_count
AdZone / AdCampaign / AdCreative / AdImpression / AdClick
Subscriber        email, status, tier, stripe_customer_id
NewsletterIssue   subject, body, sent_at, segment
```

**Body storage:** store as structured JSON (ProseMirror/TipTap document format), not HTML strings. This lets you re-render for web, newsletter, and AMP from one source, and makes embeds first-class objects rather than pasted iframes.

**Embeds:** implement an oEmbed resolver server-side. Editor pastes a YouTube/X/Instagram URL, Rails resolves it, stores the embed as a typed node, front end renders a lazy-loaded, privacy-friendly component. Faster and safer than WordPress's approach.

---

## 3. The editorial interface

This is where the project succeeds or fails. Your writers — Adam Hamilton, Tony Milanese, Trent Orwin, Bruce Stewart, and the rest — need something that is *at least* as good as what they have, or they will resist the migration.

### Recommended: custom React admin inside Rails

- **Editor:** TipTap (ProseMirror-based). Handles rich text, images, embeds, pull quotes, tables, and produces clean structured JSON. It's what most modern newsrooms build on.
- **Admin shell:** either a React SPA served by Rails, or **Avo** (Rails admin framework, commercial, very fast to build with) for the CRUD-heavy screens with TipTap dropped into the article form.
- **Must-haves for parity and beyond:**
  - Autosave every few seconds, plus full revision history with diff and restore
  - Draft preview links shareable with non-logged-in people
  - Scheduled publishing with timezone handling (you're publishing across AU/NZ/US)
  - Drag-and-drop image upload with automatic resizing, alt text prompts, and credit fields
  - Bulk media library with search — you'll have 200k assets in there
  - Role-based permissions: contributor (write own drafts), editor (publish anything), admin
  - Mobile-usable, because trackside filing is real

### Buy-instead alternatives worth pricing

| Option | Fit | Trade-off |
|---|---|---|
| **Payload CMS** (Node, self-hosted) | Excellent editorial UX, code-defined schema, free | Not Rails — you'd run Node for the CMS |
| **Directus** | Fast to stand up, good UI, self-hostable | Generic; less newsroom-shaped |
| **Ghost (Pro or self-hosted)** | Purpose-built for publishers; newsletters + paid subscriptions included | Much less flexible ad/layout control |
| **Sanity / Contentful** | Best-in-class editing, hosted | Ongoing SaaS cost scales with your traffic and asset count |

If your ambition is mainly "publish articles reliably and send newsletters," **Ghost deserves a serious look before you write a line of Rails.** It would cover articles, authors, categories, scheduling, memberships, paywall, and newsletters out of the box. You'd lose fine-grained ad serving and custom layouts.

---

## 4. Replacing Advanced Ads Pro

Don't rebuild an ad server. This is a solved, surprisingly deep problem (frequency capping, geo-targeting, pacing, viewability, reporting, fraud filtering).

| Option | Best for | Notes |
|---|---|---|
| **Broadstreet Ads** | ⭐ Direct-sold ads at publications your size | Built specifically for independent/local publishers. Self-serve advertiser portal, campaign reporting, house ads. Widely used across niche and regional news. Strongest fit. |
| **Google Ad Manager (free tier)** | Mixing direct-sold with programmatic AdSense/AdX demand | Powerful, free up to very high impression volumes, but a steep learning curve and a heavy UI |
| **Kevel** | API-first, fully custom ad experiences | Developer-friendly, more expensive, overkill unless ads are a product |
| **Lightweight in-house** | Simple sponsor placements only | A `Campaign → Creative → Zone` model with impression/click logging is ~2 weeks of work. Fine if you only run a handful of fixed sponsors (Meadowlands, NZB Airfreight, etc.) and don't need targeting or pacing. |

**Recommendation:** Broadstreet as primary, with a small in-house house-ads model in Rails for internal promos (newsletter signups, subscription prompts) so you're not paying per impression for your own marketing.

Whatever you choose: serve ad slots as React components that reserve their space before load, or you'll wreck your Core Web Vitals and Google will notice.

---

## 5. Replacing Blog2Social

| Option | Model | Notes |
|---|---|---|
| **n8n** (self-hosted) | ⭐ Workflow automation | Rails fires a webhook on publish → n8n fans out to X, Facebook, Instagram, LinkedIn, Bluesky. Free if self-hosted, total control, handles retries. |
| **Buffer** | SaaS scheduler with API | Simple, reliable, cheap, great mobile app for the team |
| **Publer** | SaaS, generous API | Strong per-network customisation, good value |
| **Zapier / Make** | SaaS automation | Easiest to set up, gets expensive at volume |
| **Direct API integration** | Build in Rails | Meta and X API terms change constantly; this becomes maintenance you don't want |

**Recommendation:** n8n if you have anyone technical who can babysit it; Buffer if you don't. Either way, model the social post as a record in your database (`SocialPost`: network, status, scheduled_for, permalink, error) so failures are visible in your admin rather than silent.

Also feed an **RSS output** — many aggregators, and some social tools, are happier with RSS than webhooks.

---

## 6. The pieces your brief didn't mention but that the screenshots reveal

These are in your current stack and *will* break if unplanned. Flagging them now:

1. **Leaky Paywall** — you have a paywall/subscription system. Replacement: Stripe Billing + your own entitlement checks, or Memberful, or Ghost's built-in memberships. This is a whole workstream, not a checkbox. Subscriber data migration must be flawless — people are paying you.
2. **"The Insider"** — a weekly Thursday newsletter with 7,000+ subscribers. Needs an ESP: Beehiiv, Ghost, Mailchimp, or Kit. Migration of a warmed sending domain and 7,000 subscribers requires care to avoid deliverability damage.
3. **Rank Math SEO** — you must replicate: meta titles/descriptions, canonical tags, Open Graph, Twitter cards, `NewsArticle` schema.org markup, XML sitemaps, **and a Google News sitemap**. Losing these tanks traffic.
4. **wpDiscuz comments** — you have threaded commenting with logged-in users. Replacement: build simple comments in Rails, or use Commento/Remark42 (self-hosted) or Disqus (adds trackers and ads). Existing comments need migrating.
5. **WPForms** — contact/submission forms. Trivial to rebuild in Rails, but don't forget it.
6. **Object caching + WPCode snippets** — audit these; they often hide business logic nobody documented.
7. **Directory** — there's a Directory item in your nav. Unknown data model. Needs scoping.
8. **Login / user accounts** — reader accounts exist. Auth, password reset, and account migration all required.

---

## 7. Preserving the header and footer

Straightforward, and worth doing properly:

1. Extract the rendered HTML and computed CSS from the live site for header, nav, and footer.
2. Rebuild as React components with Tailwind (or plain CSS modules if you want a literal transplant).
3. Nav structure — Home, News, Racing, The Insider, Contact Us, Directory, Login — becomes database-driven so you can change it without a deploy.
4. Footer's "Explore by Countries" links map to your Country model.
5. Visual regression testing (Playwright screenshots) comparing new against old at multiple breakpoints so "identical" is verified, not assumed.

The one thing I'd push back on: if the header/footer are Elementor-generated, you may be preserving markup that is part of your performance problem. Match the *design* exactly; don't inherit the DOM.

---

## 8. Migration plan

This is the highest-risk part of the project. 100k articles and 200k images with live URLs and existing search rankings.

### Phase 1 — Extract
- Pull everything via the WordPress REST API (`/wp-json/wp/v2/posts?per_page=100`) or a direct MySQL read. Avoid the WXR XML export at this volume.
- Capture for every post: ID, slug, full URL, title, content HTML, excerpt, author, categories, tags, featured image, publish date, modified date, SEO meta, comment threads.
- Inventory every media file with its full URL and post associations.

### Phase 2 — Transform
- Convert post HTML → TipTap JSON. This is the fiddly part: Elementor shortcodes, Gutenberg blocks, and classic-editor HTML all need handlers. Expect to iterate.
- Rewrite in-body image URLs to new R2 paths.
- Resolve embedded media into typed embed nodes.
- Normalise author names to Author records (watch for spelling variants of the same person).

### Phase 3 — Load
- Idempotent, resumable importer running in Sidekiq batches. It *will* fail partway through at least once; design for restart.
- Store `legacy_wp_id` and `legacy_url` on every record.
- Import images to R2 with original paths preserved where possible.

### Phase 4 — URL integrity (non-negotiable)
- Generate a complete redirect map: every old URL → new URL, 301.
- Any URL that can't be mapped goes to a logged 404 handler, not a generic page — so you can fix them from real traffic.
- Preserve category and author archive URLs, feed URLs, and pagination patterns.
- Regenerate and resubmit sitemaps; keep the old sitemap accessible during transition.

### Phase 5 — Verify before cutover
- Crawl old site and new site; diff the URL sets.
- Spot-check 500 random articles across years for rendering fidelity.
- Compare Search Console coverage before and after.
- Run both stacks in parallel with the new site on a staging domain for at least two weeks.

### Cutover
Do it on your quietest day. Have a rollback plan that is a DNS change, not a database restore.

---

## 9. Non-functional requirements

- **Performance targets:** LCP < 2.0s, CLS < 0.1, TTFB < 200ms from Australia and NZ. Measure on real 4G, not your office fibre.
- **Uptime:** you're replacing a system with downtime problems, so instrument from day one — Better Stack or Pingdom for uptime, Sentry for errors, and a status page.
- **Backups:** automated daily Postgres backups with tested restores. Untested backups are decoration.
- **Security:** rate limiting (Rack::Attack), CSP headers, dependency scanning, 2FA on admin accounts.
- **Accessibility:** WCAG 2.2 AA. It's the right thing and it's increasingly a legal exposure.
- **Analytics:** decide between GA4 and a privacy-friendly option (Plausible, Fathom). Whichever, get it in before launch so you have comparable data.

---

## 10. Suggested phasing

| Phase | Scope | Duration |
|---|---|---|
| **0** | WordPress diagnostic + emergency remediation (run this regardless) | 2 weeks |
| **1** | Rails foundation: data model, auth, admin CRUD, media pipeline to R2 | 4–6 weeks |
| **2** | Editorial UI: TipTap editor, workflow, scheduling, revisions, roles | 5–7 weeks |
| **3** | Public site: Next.js, header/footer parity, article/category/author templates, search, SEO | 6–8 weeks |
| **4** | Migration: importer, transformation, redirect map, dry runs | 5–7 weeks (overlaps 2–3) |
| **5** | Ads, social automation, newsletter, paywall, comments | 4–6 weeks |
| **6** | Parallel run, QA, visual regression, training, cutover | 3–4 weeks |

Realistically 6–8 months elapsed with overlap, assuming two full-time engineers.

---

## 11. Rough running costs (monthly, AUD, indicative)

| Item | Cost |
|---|---|
| App servers (Hetzner/DO, 2×) | $80–200 |
| Managed Postgres | $60–150 |
| Redis | $20–50 |
| Cloudflare (Pro) | $30 |
| R2 storage (~500GB) + zero egress | $15 |
| Typesense Cloud (or self-host free) | $0–100 |
| Vercel (if used) | $30–150 |
| Sentry / monitoring | $50 |
| ESP (7k+ subscribers) | $50–150 |
| Broadstreet | quoted per impression volume |
| **Total** | **~$350–900/mo** |

Likely comparable to or below what you're paying now for a struggling WordPress host, with dramatically better headroom.

---

## 12. Decisions I need from you

Answering these changes the plan materially:

**Scope and strategy**
1. Do you want the two-week WordPress diagnostic first, or are you committed to rebuilding regardless?
2. Is the Rails/React choice fixed, or is it "whatever gets us off WordPress reliably"? (If the latter, Ghost or Payload could halve the timeline.)

**Team and timeline**
3. Who's building this — in-house, agency, or contractors? How many people and what's their Rails experience?
4. Is there a hard deadline (contract expiry, hosting renewal, event)?
5. What's the honest budget range?

**Product**
6. **Paywall:** how many paying subscribers, on what plans, and through which payment processor today? This is the highest-risk data migration.
7. **The Insider:** which platform sends it now, and is the 7,000+ list in Mailchimp or elsewhere?
8. **Directory:** what actually is it? How many records, what fields, who maintains it?
9. **Comments:** how many exist, and do you want to keep them? (Many publishers use a migration as the moment to move to moderated or social-only commenting.)
10. **Ads:** roughly how many impressions/month, how many direct advertisers, and do you run any programmatic (AdSense/AdX) alongside direct sales?
11. Do you need **live racing data** — fields, results, form — pulled from HRA/HRNZ/USTA feeds? Your nav suggests "Racing" is more than articles.
12. Any **video hosting** requirements beyond YouTube embeds?
13. Do you have a **mobile app**, or want one? (Affects whether the API is public-facing from day one.)

**Content and access**
14. Can you give the build team read access to the WordPress database and an export of the media library?
15. How many active contributors, and are any of them going to struggle with a new editor?
16. Do you have brand/style guidelines, or is the current design the spec?

---

## 13. What I'd do first, this week

1. Pull your last 30 days of server logs and error logs. Find out what's actually causing the 404s — my guess is a mix of broken image references and a plugin conflict, not load.
2. Run `wp plugin list` and score every plugin: essential / replaceable / delete.
3. Check your database size and the row counts on `wp_postmeta`, `wp_options` (specifically autoloaded), and post revisions.
4. Put Cloudflare in front of the site with aggressive caching for anonymous traffic, today. It's a same-day change and may buy you months of breathing room.
5. Answer the questions in section 12 so this plan can become a scoped, costed proposal.
