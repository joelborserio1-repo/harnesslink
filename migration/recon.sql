-- migration/recon.sql
--
-- READ-ONLY WordPress reconnaissance in plain SQL. No Docker, no Ruby.
-- SELECT statements only — safe to run against a live database (it reads,
-- never writes), though a read-only replica/import is nicer if you have one.
--
-- Table prefix is hardcoded to wzev_ (confirmed in DISCOVERED_FACTS.md).
--
-- HOW TO RUN — pick whichever matches what you have:
--
--   A) On the WordPress server, via WP-CLI (uses wp-config's DB creds):
--        cd /var/www/harnesslink.com
--        wp db query < recon.sql > recon_output.txt
--
--   B) Any machine with the mysql client + the dump loaded into a database:
--        mysql -u USER -p --table DBNAME < recon.sql > recon_output.txt
--
--   C) On the server with the plain mysql client:
--        mysql -u USER -p --table DBNAME < recon.sql > recon_output.txt
--
-- Then send me recon_output.txt (it's small — a few KB).
--
-- NOTE: This deliberately OMITS the "images referenced in body content vs
-- orphaned" scan, because that requires scanning every post's content and is
-- too heavy to run against a live/struggling server. DISCOVERED_FACTS already
-- flags the ~40k attachment-vs-file gap; we'll measure the in-content
-- references separately against a dump copy. Everything else is here.

-- ========================================================================
SELECT '===== 1. PERMALINK STRUCTURE (CRITICAL — determines routing) =====' AS section;
-- ========================================================================
SELECT option_name, option_value
FROM wzev_options
WHERE option_name IN (
  'permalink_structure','home','siteurl','category_base','tag_base',
  'blogname','posts_per_page','page_on_front','show_on_front','date_format'
);

SELECT '----- Sample of 50 recent published posts (slug + date to eyeball the URL pattern) -----' AS note;
SELECT ID, post_name, post_date, LEFT(post_title, 80) AS title
FROM wzev_posts
WHERE post_type='post' AND post_status='publish' AND post_name <> ''
ORDER BY post_date DESC
LIMIT 50;

-- ========================================================================
SELECT '===== 2. POST TYPES x STATUS =====' AS section;
-- ========================================================================
SELECT post_type, post_status, COUNT(*) AS count
FROM wzev_posts
GROUP BY post_type, post_status
ORDER BY count DESC;

-- ========================================================================
SELECT '===== 3. PUBLISHED POSTS BY YEAR =====' AS section;
-- ========================================================================
SELECT YEAR(post_date) AS yr, COUNT(*) AS count
FROM wzev_posts
WHERE post_type='post' AND post_status='publish'
GROUP BY yr ORDER BY yr;

-- ========================================================================
SELECT '===== 4. DRAFTS BY YEAR (what are the 26k drafts?) =====' AS section;
-- ========================================================================
SELECT YEAR(post_date) AS yr, COUNT(*) AS count
FROM wzev_posts
WHERE post_type='post' AND post_status='draft'
GROUP BY yr ORDER BY yr;

SELECT '----- Sample drafts -----' AS note;
SELECT ID, LEFT(post_title,80) AS title, post_date, post_author
FROM wzev_posts
WHERE post_type='post' AND post_status='draft'
ORDER BY post_date DESC LIMIT 15;

-- ========================================================================
SELECT '===== 5. TAXONOMIES (all of them, with term counts) =====' AS section;
-- ========================================================================
SELECT taxonomy, COUNT(*) AS terms
FROM wzev_term_taxonomy
GROUP BY taxonomy ORDER BY terms DESC;

-- ========================================================================
SELECT '===== 6a. CATEGORIES (name, slug, parent, post count) =====' AS section;
-- ========================================================================
SELECT t.term_id, t.name, t.slug, tt.parent, tt.count AS posts
FROM wzev_term_taxonomy tt
JOIN wzev_terms t ON t.term_id = tt.term_id
WHERE tt.taxonomy='category'
ORDER BY tt.count DESC
LIMIT 200;

SELECT '===== 6b. TOP 50 TAGS =====' AS section;
SELECT t.name, t.slug, tt.count AS posts
FROM wzev_term_taxonomy tt
JOIN wzev_terms t ON t.term_id = tt.term_id
WHERE tt.taxonomy='post_tag'
ORDER BY tt.count DESC
LIMIT 50;

-- ========================================================================
SELECT '===== 7a. WP USERS WITH PUBLISHED-POST COUNTS =====' AS section;
-- ========================================================================
SELECT u.ID, u.user_login, u.display_name, u.user_email,
       COUNT(p.ID) AS posts
FROM wzev_users u
LEFT JOIN wzev_posts p
  ON p.post_author = u.ID AND p.post_type='post' AND p.post_status='publish'
GROUP BY u.ID, u.user_login, u.display_name, u.user_email
ORDER BY posts DESC;

SELECT '===== 7b. GUEST AUTHORS (Co-Authors Plus / PublishPress) =====' AS section;
SELECT ID, LEFT(post_title,80) AS name, post_name AS slug, post_status
FROM wzev_posts
WHERE post_type IN ('guest_author','ppma_boxes')
ORDER BY post_title
LIMIT 700;

SELECT '===== 7c. AUTHOR TAXONOMY TERMS (e.g. author, ppma_author) =====' AS section;
SELECT t.name, t.slug, tt.taxonomy, tt.count AS posts
FROM wzev_term_taxonomy tt
JOIN wzev_terms t ON t.term_id = tt.term_id
WHERE tt.taxonomy LIKE '%author%'
ORDER BY tt.count DESC
LIMIT 700;

-- ========================================================================
SELECT '===== 8. POST META KEYS (plugin archaeology; Rank Math etc.) =====' AS section;
-- ========================================================================
SELECT meta_key, COUNT(*) AS count
FROM wzev_postmeta
GROUP BY meta_key
HAVING count > 10
ORDER BY count DESC
LIMIT 300;

-- ========================================================================
SELECT '===== 9a. MEDIA BY MIME TYPE =====' AS section;
-- ========================================================================
SELECT post_mime_type, COUNT(*) AS count
FROM wzev_posts
WHERE post_type='attachment'
GROUP BY post_mime_type ORDER BY count DESC;

SELECT '===== 9b. ATTACHMENTS BY YEAR =====' AS section;
SELECT YEAR(post_date) AS yr, COUNT(*) AS count
FROM wzev_posts
WHERE post_type='attachment'
GROUP BY yr ORDER BY yr;

SELECT '===== 9c. TOTAL ATTACHMENTS + FILES-ON-DISk RECORDS =====' AS section;
SELECT
  (SELECT COUNT(*) FROM wzev_posts WHERE post_type='attachment') AS attachment_rows,
  (SELECT COUNT(*) FROM wzev_postmeta WHERE meta_key='_wp_attached_file') AS rows_with_file_path,
  (SELECT COUNT(DISTINCT meta_value) FROM wzev_postmeta WHERE meta_key='_thumbnail_id') AS used_as_featured_image;

-- ========================================================================
SELECT '===== 10. DUPLICATE SLUGS (published posts) =====' AS section;
-- ========================================================================
SELECT post_name, COUNT(*) AS count,
       GROUP_CONCAT(ID ORDER BY ID SEPARATOR ', ') AS ids
FROM wzev_posts
WHERE post_type='post' AND post_status='publish' AND post_name <> ''
GROUP BY post_name HAVING count > 1
ORDER BY count DESC
LIMIT 200;

-- ========================================================================
SELECT '===== 11. COMMENTS BY STATUS =====' AS section;
-- ========================================================================
SELECT comment_approved AS status, COUNT(*) AS count
FROM wzev_comments
GROUP BY comment_approved ORDER BY count DESC;

-- ========================================================================
SELECT '===== 12. ACTIVE PLUGINS (raw serialized option — I will parse it) =====' AS section;
-- ========================================================================
SELECT option_value
FROM wzev_options
WHERE option_name='active_plugins';

-- ========================================================================
SELECT '===== 13. DATABASE TABLES BY SIZE =====' AS section;
-- ========================================================================
SELECT table_name AS tbl, table_rows AS approx_rows,
       ROUND((data_length + index_length)/1024/1024, 1) AS mb
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;

-- ========================================================================
SELECT '===== 14. CONTENT DATE RANGE =====' AS section;
-- ========================================================================
SELECT MIN(post_date) AS earliest, MAX(post_date) AS latest, COUNT(*) AS published
FROM wzev_posts
WHERE post_type='post' AND post_status='publish';

-- ========================================================================
SELECT '===== 15. INTEGRITY CHECKS =====' AS section;
-- ========================================================================
SELECT 'published posts with empty slug' AS check_name,
       COUNT(*) AS count
FROM wzev_posts
WHERE post_type='post' AND post_status='publish' AND (post_name='' OR post_name IS NULL);

SELECT 'published posts with no category' AS check_name,
       COUNT(*) AS count
FROM wzev_posts p
WHERE p.post_type='post' AND p.post_status='publish'
  AND NOT EXISTS (
    SELECT 1 FROM wzev_term_relationships tr
    JOIN wzev_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    WHERE tr.object_id = p.ID AND tt.taxonomy='category'
  );

SELECT 'attachments whose parent post is gone' AS check_name,
       COUNT(*) AS count
FROM wzev_posts a
WHERE a.post_type='attachment' AND a.post_parent <> 0
  AND NOT EXISTS (SELECT 1 FROM wzev_posts p WHERE p.ID = a.post_parent);

SELECT 'featured images pointing at missing attachment' AS check_name,
       COUNT(*) AS count
FROM wzev_postmeta pm
WHERE pm.meta_key='_thumbnail_id'
  AND NOT EXISTS (SELECT 1 FROM wzev_posts p WHERE p.ID = pm.meta_value);

SELECT '===== END OF RECON =====' AS section;
