<?php
/**
 * migration/export_users.php — WordPress users → importer JSON export.
 *
 * READ-ONLY. Runs inside WP-CLI. Emits the free subscribers + editorial users
 * in the shape Wordpress::UserImporter expects (passwords are NOT exported —
 * readers authenticate via magic-link on the new site).
 *
 * Usage (on the server):
 *   cd /var/www/harnesslink.com
 *   EXPORT_LIMIT=500 wp eval-file migration/export_users.php --allow-root > users.json
 *   # EXPORT_LIMIT=0 exports everyone (large — batch for the full run).
 */

$limit = (int) (getenv('EXPORT_LIMIT') !== false ? getenv('EXPORT_LIMIT') : 500);
$args  = $limit > 0 ? ['number' => $limit, 'orderby' => 'ID', 'order' => 'ASC'] : ['orderby' => 'ID'];

$out = [];
foreach (get_users($args) as $u) {
  $out[] = [
    'id'           => (int) $u->ID,
    'email'        => $u->user_email,
    'login'        => $u->user_login,
    'display_name' => $u->display_name,
    'registered'   => $u->user_registered,
    'roles'        => array_values((array) $u->roles),
  ];
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
