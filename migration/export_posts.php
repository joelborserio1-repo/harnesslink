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
 *
 * Static pages (privacy policy, terms, …) use the same shape:
 *   EXPORT_TYPES=page EXPORT_LIMIT=0 wp eval-file migration/export_posts.php > harnesslink-pages.json
 * and load through Wordpress::PageImporter.
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
  '_wp_page_template',
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

  // Byline. The live site prints the Molongui Authorship byline, NOT the WP
  // post author (almost every post is owned by one WP user). Molongui stores
  // one `_molongui_author` meta row per author, valued "user-{ID}" or
  // "guest-{ID}" (a `guest_author` post), with `_molongui_main_author` naming
  // the lead. Author archives live at /writers/{slug}/, so the slug exported
  // here is the guest post_name / the user's nicename. Falls back to the WP
  // author only when a post carries no Molongui rows.
  $authors = [];
  $refs = array_values(array_unique(array_filter(array_merge(
    [(string) get_post_meta($id, '_molongui_main_author', true)],
    array_map('strval', (array) get_post_meta($id, '_molongui_author'))
  ))));
  foreach ($refs as $ref) {
    if (!preg_match('/^(user|guest)-(\d+)$/', $ref, $m)) continue;
    $aid = (int) $m[2];
    if ($m[1] === 'guest') {
      $g = get_post($aid);
      if (!$g || $g->post_type !== 'guest_author') continue;
      $authors[] = [
        'name' => $g->post_title,
        'slug' => $g->post_name,
        'bio'  => $g->post_content,
        'refs' => ['molongui_guest_id' => $aid],
      ];
    } else {
      $u = get_userdata($aid);
      if (!$u) continue;
      $authors[] = [
        'name' => $u->display_name,
        'slug' => $u->user_nicename,
        'bio'  => get_user_meta($aid, 'description', true),
        'refs' => ['wp_user_id' => $aid],
      ];
    }
  }
  $uid = (int) $p->post_author;
  if (!$authors && $uid) {
    $authors[] = [
      'name' => get_the_author_meta('display_name', $uid),
      'slug' => get_the_author_meta('user_nicename', $uid),
      'refs' => ['wp_user_id' => $uid, 'source' => 'post_author_fallback'],
    ];
  }

  // Featured image (imgproxy will resize the original; no file move needed yet).
  $featured = null;
  $thumb_id = get_post_thumbnail_id($id);
  if ($thumb_id) {
    $src = wp_get_attachment_image_src($thumb_id, 'full');
    if ($src) {
      $featured = [
        'legacy_id' => (int) $thumb_id,
        'url' => $src[0],
        'width' => (int) $src[1],
        'height' => (int) $src[2],
        'alt' => get_post_meta($thumb_id, '_wp_attachment_image_alt', true),
        'mime_type' => get_post_mime_type($thumb_id),
      ];
    }
  }

  $out[] = [
    'id' => $id,
    'featured' => $featured,
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
    // Full path — differs from post_name for child pages (/the-insider/editions/).
    'path' => wp_parse_url(get_permalink($id), PHP_URL_PATH),
  ];
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
