# Article Duplicator — WordPress Plugin

Scrape and import news articles from **letrot.com/actualites** (or any news listing page) into your WordPress site.

---

## Installation

1. Upload the `article-duplicator/` folder to your WordPress `/wp-content/plugins/` directory.
2. Activate the plugin in **WordPress Admin → Plugins**.
3. Find **Article Duplicator** in your left admin sidebar.

---

## Features

| Feature | Detail |
|---|---|
| **News Scraper** | Fetches articles from letrot.com/actualites |
| **Single Article Import** | Import any article by pasting its URL |
| **Bulk Import** | Preview all articles then import with one click |
| **Featured Image** | Downloads & sets article thumbnails automatically |
| **Inline Images** | Optionally sideloads all body images to media library |
| **Duplicate Detection** | Skips already-imported articles by source URL |
| **Auto-Schedule** | WP-Cron support: hourly, 6h, 12h, daily |
| **Import Log** | Tracks every import with status, title, post link |
| **Flexible Output** | Choose post type, status, category, title prefix |

---

## Pages

- **Dashboard** — Stats overview and quick actions  
- **Import Articles** — Preview & import from source  
- **Settings** — All plugin configuration  
- **Import Log** — History of every import attempt

---

## Settings Reference

| Setting | Description |
|---|---|
| Source URL | The news listing page (default: letrot.com/actualites) |
| Max Articles | How many articles to fetch per run (1–100) |
| Post Status | draft / publish / pending / private |
| Post Type | post, page, or any custom post type |
| Default Category | Auto-assign category to imported posts |
| Title Prefix | Text prepended to every post title |
| Import Featured Image | Download OG image as featured image |
| Import Inline Images | Sideload body images to media library |
| Duplicate Check | Skip articles already in the import log |
| Enable Logging | Record import activity to DB |
| Auto-Import | Enable WP-Cron scheduled scraping |
| Schedule Interval | Every 30 min / hourly / 6h / 12h / daily |

---

## How the Scraper Works

1. Fetches the source URL listing page
2. Parses article cards using DOM XPath (tries multiple selector patterns)
3. For each article, fetches the full article page
4. Extracts title, content, excerpt, date, images (via Open Graph meta + DOM)
5. Creates a WordPress post with all metadata
6. Optionally downloads images to media library

---

## Notes

- Articles are identified by their source URL for deduplication
- Metadata is stored in `_ad_source_url` and `_ad_scraped_date` post meta
- Logs are stored in the `wp_ad_import_log` database table
- The scraper includes a 1-second delay between article fetches (polite crawling)
- WP-Cron must be working on your server for scheduled imports

---

## Changelog

### 1.0.0
- Initial release
