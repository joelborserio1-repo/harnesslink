<?php
/**
 * Plugin Name: Article Duplicator
 * Plugin URI:  https://yoursite.com/article-duplicator
 * Description: Scrape and duplicate horse racing news/articles into your WordPress site.
 * Version:     2.0.1
 * Author:      Your Name
 * License:     GPL-2.0+
 * Text Domain: article-duplicator
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'AD_VERSION',     '2.0.1' );
define( 'AD_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'AD_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'AD_PLUGIN_FILE', __FILE__ );

require_once AD_PLUGIN_DIR . 'includes/class-ad-sources.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-cpt.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-scraper.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-importer.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-replays.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-results.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-byline.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-author-cleanup.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-scheduler.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-admin.php';
require_once AD_PLUGIN_DIR . 'includes/class-ad-ajax.php';

register_activation_hook( __FILE__, 'ad_activate' );
register_deactivation_hook( __FILE__, 'ad_deactivate' );

function ad_activate() {
    $defaults = [
        'ad_source_url'        => 'https://www.letrot.com/actualites',
        'ad_post_status'       => 'draft',
        'ad_post_date_mode'    => 'current',
        'ad_post_type'         => 'ad_article',
        'ad_default_category'  => '',
        'ad_default_author'    => '',
        'ad_replay_cust'       => 'HarnessLink',
        'ad_replay_tracks'     => '',
        'ad_replay_auto'       => '1',
        'ad_import_images'     => '1',
        'ad_import_featured'   => '1',
        'ad_duplicate_check'   => '1',
        'ad_auto_schedule'     => '0',
        'ad_schedule_mode'     => 'together',
        'ad_schedule_interval' => 'hourly',
        'ad_schedule_letrot'   => 'hourly',
        'ad_schedule_ustrottingnews' => 'hourly',
        'ad_schedule_swedishhorseracing' => 'hourly',
        'ad_max_articles'      => '20',
        'ad_source_slug'       => '',
        'ad_translate'         => '0',
        'ad_prefix_title'      => '',
        'ad_log_enabled'       => '1',
        'ad_rewrite_version'   => '',
    ];
    foreach ( $defaults as $key => $val ) {
        if ( false === get_option( $key ) ) {
            add_option( $key, $val );
        }
    }

    global $wpdb;
    $table   = $wpdb->prefix . 'ad_import_log';
    $charset = $wpdb->get_charset_collate();
    $sql     = "CREATE TABLE IF NOT EXISTS $table (
        id          BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        source_url  TEXT              NOT NULL,
        post_id     BIGINT(20)        DEFAULT NULL,
        post_title  TEXT              DEFAULT NULL,
        status      VARCHAR(20)       NOT NULL DEFAULT 'success',
        message     TEXT              DEFAULT NULL,
        imported_at DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) $charset;";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );

    // Register CPT then flush rewrite rules so permalinks work immediately
    $cpt = new AD_CPT();
    $cpt->register_post_type();
    $cpt->register_taxonomy();
    flush_rewrite_rules();
    update_option( 'ad_rewrite_version', AD_VERSION );
}

function ad_deactivate() {
    wp_clear_scheduled_hook( 'ad_scheduled_scrape' );
}

function ad_init() {
    new AD_CPT();
    new AD_Admin();
    new AD_Ajax();
    new AD_Scheduler();
    new AD_Replays();
    new AD_Results();
    new AD_Byline();
    if ( is_admin() ) {
        new AD_Author_Cleanup();
    }

    add_filter( 'molongui_contributors/pre_get_contributor_by', 'ad_molongui_contributors_get_guest_author', 10, 3 );
    add_action( 'init', 'ad_maybe_flush_rewrite_rules', 99 );
}
add_action( 'plugins_loaded', 'ad_init' );

function ad_maybe_flush_rewrite_rules() {
    if ( get_option( 'ad_rewrite_version' ) === AD_VERSION ) {
        return;
    }

    flush_rewrite_rules( false );
    update_option( 'ad_rewrite_version', AD_VERSION );
}

/**
 * Let Molongui Post Contributors resolve Molongui Authorship guest authors.
 *
 * Post Contributors normally resolves contributors through WP users. Imported
 * source bylines are stored as Molongui guest_author posts, so this bridge
 * turns the contributor slug back into an object Post Contributors can render.
 */
function ad_molongui_contributors_get_guest_author( $contributor, $key, $value ) {
    if ( ! in_array( $key, [ 'user_nicename', 'slug', 'login', 'user_login' ], true ) ) {
        return $contributor;
    }
    $slug = sanitize_title( preg_replace( '/^mpcu-/', '', (string) $value ) );
    if ( empty( $slug ) ) {
        return $contributor;
    }

    $guest_id = 0;
    if ( post_type_exists( 'guest_author' ) ) {
        $guests = get_posts( [
            'post_type'      => 'guest_author',
            'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
            'name'           => $slug,
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ] );

        if ( ! empty( $guests ) ) {
            $guest_id = (int) $guests[0];
        }
    }

    $display_name = '';
    $first_name   = '';
    $last_name    = '';
    $email        = '';
    $avatar       = '';

    if ( $guest_id ) {
        $display_name = get_post_meta( $guest_id, '_molongui_guest_author_display_name', true ) ?: get_the_title( $guest_id );
        $first_name   = get_post_meta( $guest_id, '_molongui_guest_author_first_name', true );
        $last_name    = get_post_meta( $guest_id, '_molongui_guest_author_last_name', true );
        $email        = get_post_meta( $guest_id, '_molongui_guest_author_mail', true );
        $avatar       = get_the_post_thumbnail_url( $guest_id, [ 20, 20 ] ) ?: '';
    } else {
        foreach ( get_taxonomies() as $taxonomy ) {
            if ( strpos( $taxonomy, 'mpb-' ) !== 0 ) continue;
            $term = get_term_by( 'slug', 'mpcu-' . $slug, $taxonomy );
            if ( $term ) {
                $guest_id      = (int) $term->term_id;
                $display_name  = $term->name;
                $description   = preg_split( '/\s+/', trim( $term->description ) );
                $first_name    = $description[0] ?? '';
                $last_name     = $description[1] ?? '';
                break;
            }
        }
    }

    if ( ! $guest_id || empty( $display_name ) ) {
        return $contributor;
    }

    return (object) [
        'ID'            => $guest_id,
        'id'            => $guest_id,
        'type'          => 'guest',
        'display_name'  => $display_name,
        'first_name'    => $first_name,
        'last_name'     => $last_name,
        'user_login'    => $slug,
        'user_nicename' => $slug,
        'user_email'    => $email,
        'term_prefix'   => function_exists( 'apply_filters' ) ? apply_filters( 'molongui_contributors/contributor_term_prefix', 'mpcu-', [ 'hyphenated' => true ] ) : 'mpcu-',
        'default_role'  => 'mpb-author',
        'avatar'        => $avatar,
    ];
}
