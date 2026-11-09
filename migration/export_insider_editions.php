<?php
/**
 * migration/export_insider_editions.php — The Insider's WordPress editions
 * (post type `edition`, served at /edition/<slug>/). READ-ONLY.
 *   sudo -u <site user> wp eval-file export_insider_editions.php > editions.json
 * Each edition's email lives on Mailchimp (`mailchimp_url`); the importer
 * copies it from there.
 */
$out = [];
foreach (get_posts(['post_type' => 'edition', 'post_status' => 'publish', 'posts_per_page' => -1, 'orderby' => 'date', 'order' => 'ASC']) as $p) {
  $out[] = [
    'id'            => (int) $p->ID,
    'slug'          => $p->post_name,
    'title'         => html_entity_decode(get_the_title($p), ENT_QUOTES),
    'edition_date'  => (string) get_post_meta($p->ID, 'edition_date', true),
    'mailchimp_url' => (string) get_post_meta($p->ID, 'mailchimp_url', true),
    'post_date_gmt' => $p->post_date_gmt,
    'seo_title'     => (string) get_post_meta($p->ID, 'rank_math_title', true),
    'seo_description' => (string) get_post_meta($p->ID, 'rank_math_description', true),
  ];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
