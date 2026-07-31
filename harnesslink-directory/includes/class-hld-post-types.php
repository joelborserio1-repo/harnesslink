<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_Post_Types {

    /** Set true once we know we're rendering a plugin (virtual) directory URL. */
    private static $rendering = false;

    public static function init() {
        add_action( 'init',                  array( __CLASS__, 'add_rewrite_rules' ) );
        add_filter( 'query_vars',            array( __CLASS__, 'query_vars' ) );
        add_action( 'template_redirect',     array( __CLASS__, 'template_redirect' ) );
        // Runs during get_header() → wp_head → wp_enqueue_scripts, after
        // template_redirect has flagged the render. Priority 20 so it lands
        // after Elementor's own enqueues.
        add_action( 'wp_enqueue_scripts',    array( __CLASS__, 'enqueue_theme_builder_css' ), 20 );
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
            self::mark_ok_query();
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
            self::mark_ok_query();
            include HLD_PLUGIN_DIR . 'templates/directory-page.php';
            exit;
        }

        /* ── Main hub (/directory) ── */
        if ( $directory ) {
            self::mark_ok_query();
            include HLD_PLUGIN_DIR . 'templates/directory-page.php';
            exit;
        }
    }

    /**
     * These directory URLs are virtual (no post backs them), so WordPress'
     * main query would otherwise flag them as 404. That makes Elementor
     * (and other Theme Builders) skip enqueueing the header/footer template
     * CSS for the request — so the footer renders unstyled on the single
     * stallion page. Force a clean 200 context before rendering so Theme
     * Builder location conditions ("Entire site") resolve and their CSS loads.
     */
    private static function mark_ok_query() {
        self::$rendering = true;
        global $wp_query;
        if ( $wp_query ) {
            $wp_query->is_404 = false;
        }
        status_header( 200 );
    }

    /**
     * Explicitly enqueue the Elementor Theme Builder header/footer template
     * CSS for our virtual URLs.
     *
     * The footer renders at wp_footer (after <head>), so Elementor must enqueue
     * its CSS during wp_enqueue_scripts. On these post-less virtual URLs its
     * automatic condition detection doesn't fire, leaving the footer unstyled.
     * We ask Elementor Pro which documents answer the header/footer locations
     * and enqueue their CSS ourselves. Fully guarded so non-Elementor / Free
     * setups are unaffected.
     */
    public static function enqueue_theme_builder_css() {
        if ( ! self::$rendering ) return;
        if ( ! class_exists( '\ElementorPro\Modules\ThemeBuilder\Module' ) ) return;
        if ( ! class_exists( '\Elementor\Core\Files\CSS\Post' ) ) return;

        $module = \ElementorPro\Modules\ThemeBuilder\Module::instance();
        if ( ! is_object( $module ) || ! method_exists( $module, 'get_conditions_manager' ) ) return;

        $conditions = $module->get_conditions_manager();
        if ( ! is_object( $conditions ) || ! method_exists( $conditions, 'get_documents_for_location' ) ) return;

        foreach ( array( 'header', 'footer' ) as $location ) {
            $documents = $conditions->get_documents_for_location( $location );
            if ( empty( $documents ) || ! is_array( $documents ) ) continue;

            foreach ( $documents as $document ) {
                if ( ! is_object( $document ) || ! method_exists( $document, 'get_main_id' ) ) continue;
                $post_id = (int) $document->get_main_id();
                if ( ! $post_id ) continue;
                try {
                    $css = \Elementor\Core\Files\CSS\Post::create( $post_id );
                    if ( is_object( $css ) && method_exists( $css, 'enqueue' ) ) {
                        $css->enqueue();
                    }
                } catch ( \Throwable $e ) {
                    // Elementor API changed — fail silently, footer degrades but site stays up.
                }
            }
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

/* ──────────────────────────────────────────────
   HORSE PROFILE HELPERS (hero, pedigree, banner, video)
────────────────────────────────────────────── */

/**
 * Ordered hero/gallery slide list for a stallion: the dedicated Hero Image
 * first (if set), then gallery images in order. Falls back to the legacy
 * profile_image URL when neither is present, so older listings still show
 * a photo without any admin action required.
 */
function hld_hero_slides( $stallion, $gallery_images ) {
    $slides = array();

    $hero_id = absint( $stallion->hero_image_id ?? 0 );
    if ( $hero_id ) {
        $full = wp_get_attachment_image_url( $hero_id, 'large' );
        if ( $full ) {
            $slides[] = array(
                'full'  => $full,
                'thumb' => wp_get_attachment_image_url( $hero_id, 'medium' ) ?: $full,
                'alt'   => get_post_meta( $hero_id, '_wp_attachment_image_alt', true ) ?: $stallion->name,
            );
        }
    }

    foreach ( (array) $gallery_images as $item ) {
        $slides[] = array(
            'full'  => $item->url,
            'thumb' => $item->url,
            'alt'   => $item->caption ?: $stallion->name,
        );
    }

    if ( empty( $slides ) && ! empty( $stallion->profile_image ) ) {
        $slides[] = array(
            'full'  => $stallion->profile_image,
            'thumb' => $stallion->profile_image,
            'alt'   => $stallion->name,
        );
    }

    return $slides;
}

/** True if the promotional banner has an image and, if dated, is within its active window. */
function hld_banner_is_active( $stallion ) {
    if ( empty( $stallion->banner_image_id ) ) return false;

    $today = current_time( 'Y-m-d' );
    if ( ! empty( $stallion->banner_start ) && $today < $stallion->banner_start ) return false;
    if ( ! empty( $stallion->banner_end ) && $today > $stallion->banner_end ) return false;

    return (bool) wp_get_attachment_image_url( absint( $stallion->banner_image_id ), 'full' );
}

/**
 * Build a pedigree tree from the stallion's ped_* fields, three generations
 * back (parents, grandparents, great-grandparents). Branches whose name is
 * empty are omitted entirely — including their own descendants — rather
 * than rendering placeholder cells.
 */
function hld_pedigree_tree( $stallion ) {
    $node = function ( $name, $children = array() ) {
        $name = trim( (string) $name );
        if ( $name === '' ) return null;
        $children = array_values( array_filter( $children ) );
        return array( 'name' => $name, 'children' => $children );
    };

    $sire = $node( $stallion->ped_sire ?? '', array(
        $node( $stallion->ped_ss ?? '', array(
            $node( $stallion->ped_sss ?? '' ),
            $node( $stallion->ped_ssd ?? '' ),
        ) ),
        $node( $stallion->ped_sd ?? '', array(
            $node( $stallion->ped_sds ?? '' ),
            $node( $stallion->ped_sdd ?? '' ),
        ) ),
    ) );

    $dam = $node( $stallion->ped_dam ?? '', array(
        $node( $stallion->ped_ds ?? '', array(
            $node( $stallion->ped_dss ?? '' ),
            $node( $stallion->ped_dsd ?? '' ),
        ) ),
        $node( $stallion->ped_dd ?? '', array(
            $node( $stallion->ped_dds ?? '' ),
            $node( $stallion->ped_ddd ?? '' ),
        ) ),
    ) );

    return $node( $stallion->name, array( $sire, $dam ) );
}

/** Recursively render a pedigree node (and its descendants) as nested, connected cells. */
function hld_render_pedigree_node( $node, $is_root = false ) {
    if ( empty( $node ) ) return;
    $has_children = ! empty( $node['children'] );
    ?>
    <div class="hld-ped-node<?= $has_children ? ' hld-ped-node--branch' : '' ?>">
      <div class="hld-ped-cell<?= $is_root ? ' hld-ped-cell--horse' : '' ?>"><?= esc_html( $node['name'] ) ?></div>
      <?php if ( $has_children ): ?>
        <div class="hld-ped-children">
          <?php foreach ( $node['children'] as $child ): ?>
            <?php hld_render_pedigree_node( $child ); ?>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
    <?php
}

/**
 * Safe embed markup for a gallery/media item. YouTube and Vimeo links render
 * as sandboxed iframes; anything else (an uploaded file) renders as a native
 * <video> element. Falls back to a plain link if the URL isn't recognised.
 */
function hld_video_embed_html( $item ) {
    $url = (string) $item->url;

    if ( preg_match( '#youtube\.com/watch\?v=([\w-]+)#i', $url, $m ) || preg_match( '#youtu\.be/([\w-]+)#i', $url, $m ) || preg_match( '#youtube\.com/embed/([\w-]+)#i', $url, $m ) ) {
        $src = 'https://www.youtube-nocookie.com/embed/' . rawurlencode( $m[1] );
        return '<iframe src="' . esc_url( $src ) . '" title="' . esc_attr( $item->caption ?: 'Video' ) . '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    }

    if ( preg_match( '#vimeo\.com/(\d+)#i', $url, $m ) ) {
        $src = 'https://player.vimeo.com/video/' . rawurlencode( $m[1] );
        return '<iframe src="' . esc_url( $src ) . '" title="' . esc_attr( $item->caption ?: 'Video' ) . '" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    }

    if ( preg_match( '/\.(mp4|webm|mov|m4v)(\?.*)?$/i', $url ) ) {
        return '<video controls preload="metadata" src="' . esc_url( $url ) . '"></video>';
    }

    return '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html( $item->caption ?: $url ) . '</a>';
}
