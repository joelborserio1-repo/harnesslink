# Post-Cutover SEO Monitoring — First 30 Days

Companion to `CUTOVER_RUNBOOK.md`. The runbook gets you *to* the flip; this gets
you *through* the 30 days where Google re-crawls, re-renders, and re-ranks
62,558 URLs. A migration that looks perfect on day 0 can still bleed rankings in
week 2 if a template regressed or redirects broke at scale.

**Principle:** watch **rate-of-change against the GSC baseline** (`migration/gsc_baseline/`),
not absolute numbers. A migration dip of a few percent that recovers within 2–3
weeks is normal Google re-processing. A sustained double-digit drop is not.

**Every threshold below is a *rollback-consideration* trigger, not an automatic
rollback.** Rollback is a DNS revert (runbook §6) and is only free from data
loss during/right after the freeze. Past ~48h, rolling back means Google has
begun indexing the new URLs and a revert has its own cost — so past 48h,
treat thresholds as "escalate + fix forward," and reserve rollback for a true
site-down / mass-deindex event. The cutover lead owns every rollback call.

---

## What to watch, and where

| Signal | Source | Why it matters |
| --- | --- | --- |
| Coverage / indexed count | GSC Pages report | Mass de-indexing = the disaster case |
| Crawl stats (requests, avg response, errors) | GSC Settings → Crawl stats | Googlebot health on the new stack |
| Clicks / impressions / avg position | GSC Performance | The actual ranking outcome |
| 404s / soft-404s | GSC Pages + app `MissedPath` log | Broken permalinks or redirects |
| Redirect health | `crawl_diff.rb` re-run | Redirects still 301, not decayed to 404 |
| Core Web Vitals | GSC CWV report + Lighthouse | Ranking factor; must hold the floor |
| 5xx / latency | App logs / uptime monitor | Availability during recrawl surge |

The app-side `MissedPath` 404 log is your **fastest** early warning — it fires
the moment a real user or Googlebot hits a path the new stack doesn't resolve,
hours before GSC reflects it. Review it daily.

---

## Cadence

### Days 0–3 — hourly-ish, hands-on
- **App logs:** 5xx rate flat; no error spike. (continuous / on-call)
- **`MissedPath` 404 log:** triage every distinct path. A legacy article path
  appearing here is a **priority-1** — add the redirect or fix the slug now.
- **GSC Crawl stats:** Googlebot getting 200s, not a wall of 404/5xx.
- **Spot parity:** re-run `seo_parity.rb` on ~200 top pages (from the baseline
  top-pages export) daily.
- **Analytics:** organic sessions vs the same weekday pre-cutover.

### Days 4–14 — daily
- GSC Performance (last 7 days vs baseline 7-day): clicks, impressions, avg
  position. Log the daily numbers in a running sheet.
- GSC Pages: indexed count trend; watch Excluded reasons for new categories
  ("Alternate page with proper canonical", "Duplicate without user-selected
  canonical", "Crawled – not indexed", "Redirect error").
- CWV report: no new "Poor" URLs group.
- Re-run **full** `crawl_diff.rb` every 2–3 days — redirects must stay 301.

### Days 15–30 — every 2–3 days
- Same GSC Performance trend; by now the migration dip should be flattening or
  recovering. If position is still sliding at day 21, investigate template/
  canonical/internal-linking regressions — it is not "just settling."
- Confirm indexed count has climbed back toward baseline.
- Final full parity + crawl-diff run at day 30 as the exit gate.

---

## Thresholds (measured against the GSC baseline)

Compare like-for-like windows (last 7 days vs the baseline's matching 7 days;
account for known seasonality and day-of-week).

| Metric | Watch (investigate) | Alert (escalate now) | Rollback-consideration |
| --- | --- | --- | --- |
| **Indexed pages** | −5% | −15% | **−25%+ or a sudden cliff** (mass de-index) |
| **Total impressions** (7-day) | −10% | −20% | **−35%+ sustained ≥5 days** |
| **Total clicks** (7-day) | −10% | −25% | **−40%+ sustained ≥5 days** |
| **Average position** | +1.0 worse | +3.0 worse | **+5.0 worse sustained ≥7 days** |
| **Top-100 query positions** | 10% dropped >3 places | 25% dropped >3 | **Majority of head terms fall off pg 1** |
| **404s (Googlebot, /day)** | any legacy article URL | >50 distinct legacy URLs | **Redirect system broadly broken** |
| **Crawl errors (5xx)** | any sustained | >1% of requests | **Site broadly unreachable to Googlebot** |
| **Core Web Vitals** | any URL group → "Needs improvement" | a group → "Poor" | **Homepage/article template LCP regressed hard** |
| **App 5xx** | >0.5% | >2% | **Site down / error storm** |

Two "Alert" rows tripping at once, or any one "Rollback-consideration" row,
convenes the cutover lead for a go-back decision. A single Watch-level blip that
recovers next day is noise — record it, don't act.

**Expected-and-fine:** a 5–15% impressions/position dip in **week 1** that
begins recovering by end of week 2. This is Google reprocessing, not failure.
Panic-rolling-back through the normal dip is itself a mistake — hold unless a
threshold above is genuinely crossed.

---

## Daily 10-minute checklist (print this)

1. App 5xx rate flat? (uptime monitor / logs)
2. `MissedPath` 404 log — any legacy article path? → fix redirect immediately.
3. GSC Crawl stats — Googlebot mostly 200s?
4. GSC Performance (last 7d) — clicks/impressions/position vs baseline within
   thresholds?
5. GSC Pages — indexed count stable or climbing?
6. Any new CWV "Poor" group?
7. Log today's numbers in the tracking sheet. Note anything at Watch+.

## Weekly (each Monday)
- Full `crawl_diff.rb` + `seo_parity.rb` run; archive the reports.
- Diff top-1,000 queries vs baseline; list any head term that fell off page 1.
- Review that week's redirect additions from the 404 log; fold recurring
  patterns into a rule rather than one-off entries.

---

## Exit criteria (end of day 30)

- Indexed count within 5% of baseline (and trending up, not down).
- Clicks/impressions/avg position within 5% of baseline for a stable 7-day run.
- Zero legacy article URLs 404ing for Googlebot.
- Crawl diff clean; parity >99.5%.
- CWV: no template in "Poor."

Meet all six → declare the migration SEO-neutral, restore normal DNS TTL, and
stand down the daily watch. Miss any → keep the daily cadence and open a
fix-forward ticket per failing signal.
