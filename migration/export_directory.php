<?php
/**
 * migration/export_directory.php — HarnessLink Directory (plugin v1.7.x) → JSON.
 *
 * READ-ONLY. Runs inside WP-CLI and prints every listing with its progeny,
 * gallery, "Crosses of Gold" and related ids, plus the enquiries, in the shape
 * cms/scripts/import-directory.js expects.
 *
 *   wp eval-file migration/export_directory.php > directory.json
 */
global $wpdb;
$p = $wpdb->prefix;

$listings = $wpdb->get_results("SELECT * FROM {$p}hld_stallions ORDER BY id", ARRAY_A);
$children = function ($table, $order) use ($wpdb, $p) {
  $rows = $wpdb->get_results("SELECT * FROM {$p}{$table} ORDER BY stallion_id, {$order}", ARRAY_A);
  $by = [];
  foreach ($rows as $r) $by[$r['stallion_id']][] = $r;
  return $by;
};
$progeny = $children('hld_progeny', 'sort_order, prizemoney_num DESC');
$gallery = $children('hld_gallery', 'sort_order');
$crosses = $children('hld_crosses', 'sort_order');

$att = function ($id) {
  if (!$id) return null;
  $src = wp_get_attachment_image_src((int) $id, 'full');
  return $src ? ['url' => $src[0], 'width' => (int) $src[1], 'height' => (int) $src[2]] : null;
};

$out = [];
foreach ($listings as $l) {
  $id = $l['id'];
  // The slug the live site puts in profile URLs (hld_listing_url).
  $l['slug'] = sanitize_title($l['name']);
  $l['hero_image'] = $att($l['hero_image_id']);
  $l['banner_image'] = $att($l['banner_image_id']);
  $l['progeny'] = $progeny[$id] ?? [];
  $l['gallery'] = array_map(function ($g) use ($att) {
    if (!$g['url'] && $g['attachment_id']) { $a = $att($g['attachment_id']); $g['url'] = $a ? $a['url'] : ''; }
    return $g;
  }, $gallery[$id] ?? []);
  $l['crosses'] = $crosses[$id] ?? [];
  $out[] = $l;
}

echo json_encode([
  'listings' => $out,
  'enquiries' => $wpdb->get_results("SELECT * FROM {$p}hld_enquiries ORDER BY id", ARRAY_A),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
