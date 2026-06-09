<?php
/**
 * Plugin Name: HarnessLink Directory
 * Plugin URI:  https://harnesslink.com
 * Description: Scalable multi-category directory for HarnessLink (stallions, trainers, drivers, agistment, transport, vets and more) with paid/free tier listings, CSV import, and internal profile pages.
 * Version:     1.3.2
 * Author:      HarnessLink
 * Text Domain: harnesslink-directory
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HLD_VERSION',    '1.3.2' );
define( 'HLD_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'HLD_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

function hld_login_url( $redirect_to = '' ) {
    $redirect_to = $redirect_to ?: home_url( '/directory/' );

    // Prefer the plugin's own front-end login page (WordPress-core based).
    if ( class_exists( 'HLD_Auth' ) ) {
        return HLD_Auth::login_url( $redirect_to );
    }

    // Legacy fallback: Ultimate Member login page if present.
    if ( function_exists( 'um_get_core_page' ) ) {
        $um_login_url = um_get_core_page( 'login' );
        if ( $um_login_url ) {
            return add_query_arg( 'redirect_to', rawurlencode( $redirect_to ), $um_login_url );
        }
    }

    return wp_login_url( $redirect_to );
}

/* ── Autoload includes ── */
require_once HLD_PLUGIN_DIR . 'includes/class-hld-types.php';
require_once HLD_PLUGIN_DIR . 'includes/class-hld-db.php';
require_once HLD_PLUGIN_DIR . 'includes/class-hld-post-types.php';
require_once HLD_PLUGIN_DIR . 'includes/class-hld-shortcodes.php';
require_once HLD_PLUGIN_DIR . 'includes/class-hld-auth.php';
require_once HLD_PLUGIN_DIR . 'includes/class-hld-ajax.php';
require_once HLD_PLUGIN_DIR . 'admin/class-hld-admin.php';

/* ── Activation / Deactivation ── */
function hld_activate() {
    HLD_Types::seed();
    HLD_DB::install();
    // Make sure the new /directory/{type}/ rewrite rules are live immediately.
    HLD_Post_Types::add_rewrite_rules();
    flush_rewrite_rules();
}
register_activation_hook( __FILE__,   'hld_activate' );
register_deactivation_hook( __FILE__, array( 'HLD_DB', 'deactivate' ) );

/* ── Boot ── */
add_action( 'plugins_loaded', function () {
    HLD_Types::seed();
    HLD_DB::maybe_upgrade();
    HLD_Post_Types::init();
    HLD_Shortcodes::init();
    HLD_Auth::init();
    HLD_Ajax::init();
    HLD_Admin::init();
} );

/* ── One-time rewrite flush after an upgrade ── */
add_action( 'init', function () {
    if ( get_option( 'hld_needs_flush' ) === '1' ) {
        flush_rewrite_rules();
        delete_option( 'hld_needs_flush' );
    }
}, 99 );

/* ── Front-end assets ── */
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'hld-public',
        HLD_PLUGIN_URL . 'public/css/hld-public.css',
        array(),
        HLD_VERSION
    );
    wp_enqueue_script(
        'hld-public',
        HLD_PLUGIN_URL . 'public/js/hld-public.js',
        array( 'jquery' ),
        HLD_VERSION,
        true
    );
    wp_localize_script( 'hld-public', 'HLD', array(
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'hld_nonce' ),
    ) );
} );
