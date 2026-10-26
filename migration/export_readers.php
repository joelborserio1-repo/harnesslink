<?php
/**
 * migration/export_readers.php — WordPress readers → Strapi reader import.
 *
 * READ-ONLY. Runs inside WP-CLI on the live server:
 *   sudo -u <site user> wp eval-file export_readers.php > readers.json
 *
 * Exports subscribers only (staff are invited into Strapi instead), with
 * their WordPress password HASH so they can keep their password: the new
 * site checks it on their first sign-in, then stores its own hash and
 * forgets this one. The output contains password hashes — keep it
 * root-only (chmod 600) and delete it after the import.
 */

$out = [];
foreach (get_users(['role' => 'subscriber', 'orderby' => 'ID', 'order' => 'ASC']) as $u) {
  $out[] = [
    'id'         => (int) $u->ID,
    'email'      => strtolower(trim($u->user_email)),
    'first_name' => (string) get_user_meta($u->ID, 'first_name', true),
    'last_name'  => (string) get_user_meta($u->ID, 'last_name', true),
    'registered' => $u->user_registered . 'Z', // WordPress stores this in UTC
    'pass'       => $u->user_pass,
  ];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
