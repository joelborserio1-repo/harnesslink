<?php
/**
 * migration/export_photos.php — WordPress photo library → JSON, for the
 * Strapi photo archive (cms/scripts/import-photos.js). READ-ONLY: SELECTs and
 * file_exists() only.
 *
 * Runs inside WP-CLI on the server:
 *   EXPORT_AFTER_ID=0 EXPORT_LIMIT=5000 wp eval-file export_photos.php > photos-1.json
 *       the next 5000 images by ID after EXPORT_AFTER_ID (full backfill, in pages)
 *   EXPORT_SINCE="2026-11-10 03:00:00" wp eval-file export_photos.php
 *       images uploaded or edited since then (UTC) — the 10-minute sync
 *   EXPORT_IDS=1 wp eval-file export_photos.php
 *       just the IDs of every image (nightly check for deleted ones)
 *
 * Each record: id, url, thumb (WordPress's medium-size copy, if any), title,
 * alt, caption, description, mime, width, height, date, modified, parent
 * (the post it was uploaded into), exists (is the file actually on disk —
 * ~40k old attachment rows point at missing files).
 */

global $wpdb;

if (getenv('EXPORT_IDS')) {
  $ids = $wpdb->get_col("SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%'");
  echo json_encode(array_map('intval', $ids));
  return;
}

$since = getenv('EXPORT_SINCE') ?: '';
$after = (int) (getenv('EXPORT_AFTER_ID') ?: 0);
$limit = (int) (getenv('EXPORT_LIMIT') ?: 5000);

$cols = "ID, post_title, post_excerpt, post_content, post_mime_type, post_date_gmt, post_date, post_modified_gmt, post_parent";
if ($since) {
  $rows = $wpdb->get_results($wpdb->prepare(
    "SELECT $cols FROM {$wpdb->posts}
      WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%%'
        AND (post_modified_gmt >= %s OR post_date_gmt >= %s)
      ORDER BY ID", $since, $since));
} else {
  $rows = $wpdb->get_results($wpdb->prepare(
    "SELECT $cols FROM {$wpdb->posts}
      WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%%' AND ID > %d
      ORDER BY ID LIMIT %d", $after, $limit));
}

$meta = [];
if ($rows) {
  $ids = implode(',', array_map(function ($r) { return (int) $r->ID; }, $rows));
  $m = $wpdb->get_results("SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta}
    WHERE post_id IN ($ids) AND meta_key IN ('_wp_attached_file', '_wp_attachment_image_alt', '_wp_attachment_metadata')");
  foreach ($m as $r) $meta[(int) $r->post_id][$r->meta_key] = $r->meta_value;
}

$uploads = wp_get_upload_dir();
$base_url = rtrim($uploads['baseurl'], '/');
$base_dir = rtrim($uploads['basedir'], '/');
$clean = function ($s) { return trim(wp_strip_all_tags(html_entity_decode((string) $s, ENT_QUOTES))); };

$out = [];
foreach ($rows as $r) {
  $id = (int) $r->ID;
  $file = isset($meta[$id]['_wp_attached_file']) ? ltrim($meta[$id]['_wp_attached_file'], '/') : '';
  if ($file === '' || preg_match('#^https?://#', $file)) continue;
  $md = isset($meta[$id]['_wp_attachment_metadata']) ? maybe_unserialize($meta[$id]['_wp_attachment_metadata']) : [];
  if (!is_array($md)) $md = [];
  $dir = dirname($file) === '.' ? '' : dirname($file) . '/';
  $thumb = null;
  foreach (['medium_large', 'medium', 'thumbnail'] as $size) {
    if (!empty($md['sizes'][$size]['file'])) { $thumb = $base_url . '/' . $dir . $md['sizes'][$size]['file']; break; }
  }
  $out[] = [
    'id' => $id,
    'url' => $base_url . '/' . $file,
    'thumb' => $thumb,
    'title' => $clean($r->post_title),
    'alt' => $clean(isset($meta[$id]['_wp_attachment_image_alt']) ? $meta[$id]['_wp_attachment_image_alt'] : ''),
    'caption' => $clean($r->post_excerpt),
    'description' => $clean($r->post_content),
    'mime' => $r->post_mime_type,
    'width' => isset($md['width']) ? (int) $md['width'] : null,
    'height' => isset($md['height']) ? (int) $md['height'] : null,
    'date' => ($r->post_date_gmt && $r->post_date_gmt !== '0000-00-00 00:00:00') ? $r->post_date_gmt : $r->post_date,
    'modified' => $r->post_modified_gmt,
    'parent' => (int) $r->post_parent ?: null,
    'exists' => file_exists($base_dir . '/' . $file),
  ];
}
echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
