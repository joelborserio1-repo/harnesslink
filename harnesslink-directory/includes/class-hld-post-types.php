<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_Post_Types {

    public static function init() {
        add_action( 'init',                  array( __CLASS__, 'add_rewrite_rules' ) );
        add_filter( 'query_vars',            array( __CLASS__, 'query_vars' ) );
        add_action( 'template_redirect',     array( __CLASS__, 'template_redirect' ) );
    }

    public static function add_rewrite_rules() {
        /* Legacy stallion profile URLs (kept so previously shared/indexed
           links such as /directory/stallions/123/name keep resolving). */
        add_rewrite_rule(
            '^directory/stallions/([0-9]+)(/[^/]*)?/?$',
            'index.php?hld_listing_type=stallion&hld_listing_id=$matches[1]',
            'top'
        );

        /* Generic profile: /directory/{type}/{id}/{slug} */
        add_rewrite_rule(
            '^directory/([^/]+)/([0-9]+)(/[^/]*)?/?$',
            'index.php?hld_listing_type=$matches[1]&hld_listing_id=$matches[2]',
            'top'
        );

        /* Generic type archive: /directory/{type} */
        add_rewrite_rule(
            '^directory/([^/]+)/?$',
            'index.php?hld_dir_type=$matches[1]',
            'top'
        );

        /* Main hub: /directory */
        add_rewrite_rule(
            '^directory/?$',
            'index.php?hld_directory=1',
            'top'
        );
    }

    public static function query_vars( $vars ) {
        $vars[] = 'hld_stallion_id';   // legacy
        $vars[] = 'hld_listing_id';
        $vars[] = 'hld_listing_type';
        $vars[] = 'hld_dir_type';
        $vars[] = 'hld_directory';
        return $vars;
    }

    public static function template_redirect() {
        $listing_id = get_query_var( 'hld_listing_id' ) ?: get_query_var( 'hld_stallion_id' );
        $dir_type   = get_query_var( 'hld_dir_type' );
        $directory  = get_query_var( 'hld_directory' );

        /* ── Single listing profile ── */
        if ( $listing_id ) {
            $listing = HLD_DB::get_stallion( $listing_id );
            if ( ! $listing ) {
                global $wp_query;
                $wp_query->set_404();
                status_header( 404 );
                return;
            }
            // Make the record available to the template under both names.
            $stallion = $listing;
            include HLD_PLUGIN_DIR . 'templates/stallion-profile.php';
            exit;
        }

        /* ── Type archive (/directory/{type}) ── */
        if ( $dir_type ) {
            $resolved = HLD_Types::sanitize_slug( $dir_type );
            if ( ! HLD_Types::exists( $resolved ) ) {
                global $wp_query;
                $wp_query->set_404();
                status_header( 404 );
                return;
            }
            $hld_active_type = $resolved;
            include HLD_PLUGIN_DIR . 'templates/directory-page.php';
            exit;
        }

        /* ── Main hub (/directory) ── */
        if ( $directory ) {
            include HLD_PLUGIN_DIR . 'templates/directory-page.php';
            exit;
        }
    }
}

/* ──────────────────────────────────────────────
   URL helpers (shared by templates, rows, nav)
────────────────────────────────────────────── */

/** Front-end archive URL for a directory type. */
function hld_directory_url( $type = '' ) {
    $type = HLD_Types::sanitize_slug( $type );
    if ( ! $type || $type === HLD_Types::default_slug() ) {
        return home_url( '/directory/' );
    }
    return home_url( '/directory/' . $type . '/' );
}

/** Internal profile URL for a listing row object. */
function hld_listing_url( $listing ) {
    $type = HLD_Types::sanitize_slug( $listing->directory_type ?? 'stallion' );
    if ( ! $type ) $type = 'stallion';
    $slug = sanitize_title( $listing->name );
    return home_url( '/directory/' . $type . '/' . (int) $listing->id . '/' . $slug );
}
