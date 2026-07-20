<?php
/**
 * migration/export_posts.php — WordPress → importer JSON export.
 *
 * Runs inside WP-CLI (uses live WP functions, READ-ONLY) and prints a JSON
 * array of post records in exactly the shape the Rails importer expects.
 *
 * Usage (on the server):
 *   cd /var/www/harnesslink.com
 *   EXPORT_LIMIT=500 wp eval-file migration/export_posts.php > harnesslink-posts.json
 *
 * Then upload harnesslink-posts.json — the importer loads it directly.
 * Set EXPORT_LIMIT=0 to export everything (large!). EXPORT_TYPES defaults to "post".
 */

$limit = (int) (getenv('EXPORT_LIMIT') !== false ? getenv('EXPORT_LIMIT') : 500);
$types = getenv('EXPORT_TYPES') ? explode(',', getenv('EXPORT_TYPES')) : ['post'];

$editorial = ['Top 4', 'Blog', 'Articles', 'Podcast', 'Videos'];
$meta_keys = [
  'post_subtitle',
  'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword',
  'rank_math_canonical_url', 'rank_math_robots',
  'rank_math_facebook_title', 'rank_math_facebook_description',
  'rank_math_twitter_title', 'rank_math_twitter_description',
  '_molongui_main_author', '_thumbnail_id', '_elementor_data',
];

$query = new WP_Query([
  'post_type'      => $types,
  'post_status'    => 'publish',
  'posts_per_page' => $limit > 0 ? $limit : -1,
  'orderby'        => 'date',
  'order'          => 'DESC',
  'no_found_rows'  => true,
]);

$out = [];
foreach ($query->posts as $p) {
  $id = $p->ID;

  $meta = [];
  foreach ($meta_keys as $k) {
    $v = get_post_meta($id, $k, true);
    if ($v !== '' && $v !== null) $meta[$k] = $v;
  }

  $cats = [];
  foreach (wp_get_post_terms($id, 'category') as $t) {
    $cats[] = ['name' => $t->name, 'slug' => $t->slug, 'legacy_term_id' => $t->term_id,
               'kind' => in_array($t->name, $editorial, true) ? 'editorial' : 'geographic'];
  }
  $tags = [];
  foreach (wp_get_post_terms($id, 'post_tag') as $t) {
    $tags[] = ['name' => $t->name, 'slug' => $t->slug, 'legacy_term_id' => $t->term_id];
  }

  // Baseline byline = WP author. (Co-Authors/Molongui resolution comes later.)
  $authors = [];
  $uid = $p->post_author;
  if ($uid) {
    $authors[] = [
      'name' => get_the_author_meta('display_name', $uid),
      'slug' => get_the_author_meta('user_nicename', $uid),
      'refs' => ['wp_user_id' => (int) $uid],
    ];
  }

  $out[] = [
    'id' => $id,
    'post_name' => $p->post_name,
    'post_title' => $p->post_title,
    'post_content' => $p->post_content,
    'post_excerpt' => $p->post_excerpt,
    'post_date' => $p->post_date_gmt ?: $p->post_date,
    'post_modified' => $p->post_modified_gmt ?: $p->post_modified,
    'post_status' => $p->post_status,
    'post_type' => $p->post_type,
    'meta' => $meta,
    'categories' => $cats,
    'tags' => $tags,
    'authors' => $authors,
    'old_slugs' => get_post_meta($id, '_wp_old_slug'),
  ];
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
