<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Guest Author cleanup screen.
 *
 * Older plugin versions auto-created a guest_author entry from every
 * scraped byline, flooding the Guest Authors screen with duplicates and
 * junk ("TR Media: Today 9:29 PM", "from Northfield Park", …). This
 * screen is a dry run by default: it lists duplicate groups and
 * junk-looking entries and changes nothing until a button is clicked.
 */
class AD_Author_Cleanup {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_menu' ], 20 );
    }

    public function register_menu() {
        add_submenu_page(
            'article-duplicator',
            __( 'Author Cleanup', 'article-duplicator' ),
            __( 'Author Cleanup', 'article-duplicator' ),
            'manage_options',
            'artdup-author-cleanup',
            [ $this, 'page' ]
        );
    }

    /* =========================================================
       DATA
    ========================================================= */

    private function get_guests() {
        if ( ! post_type_exists( 'guest_author' ) ) {
            return [];
        }
        return get_posts( [
            'post_type'      => 'guest_author',
            'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ] );
    }

    /**
     * Posts linked to each guest author (via Molongui main-author meta).
     * Returns [ guest_id => count ].
     */
    private function get_usage_counts() {
        global $wpdb;
        $counts = [];
        $rows   = $wpdb->get_results(
            "SELECT meta_value, COUNT(DISTINCT post_id) AS c
             FROM {$wpdb->postmeta}
             WHERE meta_key = '_molongui_main_author' AND meta_value LIKE 'guest-%'
             GROUP BY meta_value"
        );
        foreach ( $rows as $row ) {
            $counts[ (int) substr( $row->meta_value, 6 ) ] = (int) $row->c;
        }
        return $counts;
    }

    private function normalize( $title ) {
        return mb_strtolower( trim( preg_replace( '/\s+/', ' ', (string) $title ) ) );
    }

    /**
     * Conservative junk detection: only patterns that cannot be a real
     * person's name (timestamps, dates, leading from/by).
     */
    private function looks_like_junk( $title ) {
        $title = trim( (string) $title );
        if ( '' === $title ) return true;
        if ( preg_match( '/\d{1,2}:\d{2}/', $title ) ) return true;                                  // "Today 9:29 PM"
        if ( preg_match( '/^(from|by)\s/i', $title ) ) return true;                                  // "from Northfield Park"
        if ( preg_match( '/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+20\d\d\b/i', $title ) ) return true;
        if ( preg_match( '/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i', $title ) ) return true;
        return false;
    }

    /* =========================================================
       ACTIONS
    ========================================================= */

    private function handle_actions() {
        if ( empty( $_POST['ad_cleanup_action'] ) ) return '';
        if ( ! current_user_can( 'manage_options' ) ) return '';
        check_admin_referer( 'ad_author_cleanup' );

        $action = sanitize_text_field( $_POST['ad_cleanup_action'] );

        if ( 'merge' === $action ) {
            $merged = $this->merge_duplicates();
            return sprintf( __( 'Merged %d duplicate guest author entries.', 'article-duplicator' ), $merged );
        }

        if ( 'delete' === $action ) {
            $ids     = array_map( 'absint', (array) ( $_POST['guest_ids'] ?? [] ) );
            $deleted = 0;
            foreach ( $ids as $id ) {
                if ( $id && 'guest_author' === get_post_type( $id ) ) {
                    wp_delete_post( $id, true );
                    $deleted++;
                }
            }
            return sprintf( __( 'Deleted %d guest author entries.', 'article-duplicator' ), $deleted );
        }

        return '';
    }

    /**
     * Merge each duplicate group into its keeper (most used, then oldest),
     * repointing Molongui post references before deleting the spares.
     */
    private function merge_duplicates() {
        global $wpdb;

        $usage  = $this->get_usage_counts();
        $merged = 0;

        foreach ( $this->duplicate_groups() as $group ) {
            usort( $group, function ( $a, $b ) use ( $usage ) {
                $ua = $usage[ $a->ID ] ?? 0;
                $ub = $usage[ $b->ID ] ?? 0;
                if ( $ua !== $ub ) return $ub - $ua;   // most used first
                return $a->ID - $b->ID;                // then oldest
            } );

            $keeper = array_shift( $group );

            foreach ( $group as $dup ) {
                foreach ( [ '_molongui_main_author', '_molongui_author' ] as $key ) {
                    $wpdb->query( $wpdb->prepare(
                        "UPDATE {$wpdb->postmeta} SET meta_value = %s WHERE meta_key = %s AND meta_value = %s",
                        'guest-' . $keeper->ID, $key, 'guest-' . $dup->ID
                    ) );
                }
                wp_delete_post( $dup->ID, true );
                $merged++;
            }
        }

        return $merged;
    }

    private function duplicate_groups() {
        $by_name = [];
        foreach ( $this->get_guests() as $guest ) {
            $by_name[ $this->normalize( get_the_title( $guest ) ) ][] = $guest;
        }
        return array_values( array_filter( $by_name, function ( $g ) {
            return count( $g ) > 1;
        } ) );
    }

    /* =========================================================
       PAGE
    ========================================================= */

    public function page() {
        $notice = $this->handle_actions();

        $usage  = $this->get_usage_counts();
        $groups = $this->duplicate_groups();
        $junk   = array_filter( $this->get_guests(), function ( $g ) {
            return $this->looks_like_junk( get_the_title( $g ) );
        } );
        ?>
        <div class="wrap artdup-wrap">
            <h1 class="artdup-page-title"><span class="dashicons dashicons-admin-users"></span> <?php _e( 'Guest Author Cleanup', 'article-duplicator' ); ?></h1>

            <?php if ( $notice ) : ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
            <?php endif; ?>

            <p class="description" style="max-width:720px;">
                <?php _e( 'This page only reports until you click an action button. "Articles" is how many posts are linked to the entry — merging repoints those posts to the kept entry first, and article bylines are stored on the articles themselves, so deleting entries never changes what is displayed.', 'article-duplicator' ); ?>
            </p>

            <!-- DUPLICATES -->
            <div class="artdup-panel">
                <h2><?php printf( __( 'Duplicate names (%d groups)', 'article-duplicator' ), count( $groups ) ); ?></h2>
                <?php if ( empty( $groups ) ) : ?>
                    <p><?php _e( 'No duplicates found.', 'article-duplicator' ); ?></p>
                <?php else : ?>
                    <table class="widefat striped" style="max-width:720px;">
                        <thead><tr>
                            <th><?php _e( 'Name', 'article-duplicator' ); ?></th>
                            <th><?php _e( 'Entry ID', 'article-duplicator' ); ?></th>
                            <th><?php _e( 'Articles', 'article-duplicator' ); ?></th>
                            <th><?php _e( 'Action', 'article-duplicator' ); ?></th>
                        </tr></thead>
                        <tbody>
                        <?php foreach ( $groups as $group ) :
                            $sorted = $group;
                            usort( $sorted, function ( $a, $b ) use ( $usage ) {
                                $ua = $usage[ $a->ID ] ?? 0;
                                $ub = $usage[ $b->ID ] ?? 0;
                                if ( $ua !== $ub ) return $ub - $ua;
                                return $a->ID - $b->ID;
                            } );
                            foreach ( $sorted as $i => $guest ) : ?>
                            <tr>
                                <td><?php echo esc_html( get_the_title( $guest ) ); ?></td>
                                <td>#<?php echo (int) $guest->ID; ?></td>
                                <td><?php echo (int) ( $usage[ $guest->ID ] ?? 0 ); ?></td>
                                <td><?php echo 0 === $i
                                    ? '<strong style="color:#057a55">' . esc_html__( 'Keep', 'article-duplicator' ) . '</strong>'
                                    : '<span style="color:#c81e1e">' . esc_html__( 'Merge into kept entry', 'article-duplicator' ) . '</span>'; ?></td>
                            </tr>
                            <?php endforeach;
                        endforeach; ?>
                        </tbody>
                    </table>
                    <form method="post" style="margin-top:12px;"
                          onsubmit="return confirm('<?php echo esc_js( __( 'Merge all duplicate groups as shown? Linked posts are repointed to the kept entry.', 'article-duplicator' ) ); ?>');">
                        <?php wp_nonce_field( 'ad_author_cleanup' ); ?>
                        <input type="hidden" name="ad_cleanup_action" value="merge" />
                        <button type="submit" class="button button-primary"><?php _e( 'Merge all duplicates as shown', 'article-duplicator' ); ?></button>
                    </form>
                <?php endif; ?>
            </div>

            <!-- JUNK -->
            <div class="artdup-panel">
                <h2><?php printf( __( 'Junk-looking entries (%d)', 'article-duplicator' ), count( $junk ) ); ?></h2>
                <p class="description"><?php _e( 'Flagged because the name contains a time, a date, a weekday, or starts with “from/by” — review and untick anything you want to keep.', 'article-duplicator' ); ?></p>
                <?php if ( empty( $junk ) ) : ?>
                    <p><?php _e( 'Nothing flagged.', 'article-duplicator' ); ?></p>
                <?php else : ?>
                    <form method="post"
                          onsubmit="return confirm('<?php echo esc_js( __( 'Permanently delete the checked guest author entries?', 'article-duplicator' ) ); ?>');">
                        <?php wp_nonce_field( 'ad_author_cleanup' ); ?>
                        <input type="hidden" name="ad_cleanup_action" value="delete" />
                        <table class="widefat striped" style="max-width:720px;">
                            <thead><tr>
                                <th style="width:30px;"><input type="checkbox" onclick="jQuery('.ad-junk-cb').prop('checked', this.checked);" /></th>
                                <th><?php _e( 'Name', 'article-duplicator' ); ?></th>
                                <th><?php _e( 'Entry ID', 'article-duplicator' ); ?></th>
                                <th><?php _e( 'Articles', 'article-duplicator' ); ?></th>
                            </tr></thead>
                            <tbody>
                            <?php foreach ( $junk as $guest ) : $n = (int) ( $usage[ $guest->ID ] ?? 0 ); ?>
                            <tr>
                                <td><input type="checkbox" class="ad-junk-cb" name="guest_ids[]" value="<?php echo (int) $guest->ID; ?>" <?php checked( 0 === $n ); ?> /></td>
                                <td><?php echo esc_html( get_the_title( $guest ) ); ?></td>
                                <td>#<?php echo (int) $guest->ID; ?></td>
                                <td><?php echo $n; ?></td>
                            </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                        <p><button type="submit" class="button button-primary"><?php _e( 'Delete checked entries', 'article-duplicator' ); ?></button>
                        <span class="description"><?php _e( 'Entries still linked to articles are unticked by default.', 'article-duplicator' ); ?></span></p>
                    </form>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }
}
