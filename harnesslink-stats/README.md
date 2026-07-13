# HarnessLink Journalist Stats

WordPress admin plugin: a PIN-protected dashboard under **Tools → Journalist Stats**
that reports **story output** (how many stories are published, per day / per week and
by category) alongside the existing **views & cost-per-view** figures per journalist.

## What's in v3.1.0

The dashboard now leads with story-output reporting, added on top of the existing
views/cost tables (nothing was removed):

| Tab | Shows |
| --- | --- |
| **Stories / Day** | One row per day: total stories published, broken down into columns per category (USA, AU, …). |
| **Stories / Week** | Same, grouped by ISO week (Mon–Sun), week-commencing labels. |
| **By Category** | Each category with total stories, share, avg/day and avg/week. Click a category to drill into its daily output. |
| **By Journalist** | Existing: articles, views, cost, cost-per-view, trend. |
| **Views · Monthly / Weekly** | Existing per-journalist view breakdowns. |
| **All Articles** | Existing paginated article list. |

New summary cards: **Stories Published**, **Avg Stories / Day**, **Avg Stories / Week**
(in addition to the existing views/cost cards).

Every tab supports date presets (This Week, Last Week, This Month, …, All Time),
a custom date range, an author filter, a **category filter**, and **CSV export**.

## Categories (USA, AU, …)

Which taxonomy holds the geographic categories is configurable at
**Tools → Journalist Costs → Category taxonomy**. It defaults to the built-in
`category` taxonomy but can be pointed at any registered public taxonomy
(e.g. a custom `region` / `country` taxonomy). A story tagged in more than one
category is counted under each, so category totals can exceed the distinct
"Stories Published" count — this is noted in-dashboard.

## Access PIN

The dashboard is gated behind a 4-digit PIN. **The PIN is 1234.** It is set
automatically on activation/upgrade and can be changed at
**Tools → Journalist Costs → Dashboard PIN**.

## Data sources

- **Story counts & categories** — WordPress core (`wp_posts`, term tables). No
  third-party dependency.
- **Views & cost-per-view** — WordPress Popular Posts tables (`wzev_popularpostsdata`,
  `wzev_popularpostssummary`). If you drop WP Popular Posts, the output/category
  tabs keep working; only the views/cost figures go to zero.

## Install

Upload the `harnesslink-stats` folder to `wp-content/plugins/` and activate,
or zip the folder and install via **Plugins → Add New → Upload**.
