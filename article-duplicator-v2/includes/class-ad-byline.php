<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Byline display + editing for imported articles.
 *
 * The theme (JNews) renders the visible author from the WP account that
 * owns the post, which is always the shared Harnesslink account. The
 * selected author is stored in _ad_guest_author post meta, so this class
 * filters the standard author display functions to show that name on the
 * front end, and adds a "Published By" box to the post editor so the
 * byline can be set or corrected on any article.
 */
class AD_Byline {

    const META_KEY = '_ad_guest_author';

    public function __construct() {
        add_filter( 'the_author', [ $this, 'filter_the_author' ] );
        add_filter( 'get_the_author_display_name', [ $this, 'filter_display_name' ], 10, 2 );

        add_action( 'add_meta_boxes', [ $this, 'register_meta_box' ] );
        add_action( 'save_post',      [ $this, 'save_meta_box' ] );
    }

    /* =========================================================
       FRONT-END BYLINE
    ========================================================= */

    public function filter_the_author( $display_name ) {
        return $this->byline_for_current_post() ?: $display_name;
    }

    public function filter_display_name( $display_name, $user_id = 0 ) {
        return $this->byline_for_current_post() ?: $display_name;
    }

    private function byline_for_current_post() {
        if ( is_admin() ) {
            return '';
        }

        $post = get_post();
        if ( ! $post ) {
            return '';
        }

        return (string) get_post_meta( $post->ID, self::META_KEY, true );
    }

    /* =========================================================
       META BOX ("Published By" on the post editor)
    ========================================================= */

    public function register_meta_box() {
        $screens = array_unique( [ 'post', AD_CPT::POST_TYPE, get_option( 'ad_post_type', AD_CPT::POST_TYPE ) ] );
        foreach ( $screens as $screen ) {
            add_meta_box(
                'ad-byline-box',
                __( 'Published By', 'article-duplicator' ),
                [ $this, 'render_meta_box' ],
                $screen,
                'side',
                'high'
            );
        }
    }

    public function render_meta_box( $post ) {
        wp_nonce_field( 'ad_byline_meta', 'ad_byline_nonce' );

        $byline = get_post_meta( $post->ID, self::META_KEY, true );

        // Suggestions: guest author entries first, then site users.
        $suggestions = [];
        if ( post_type_exists( 'guest_author' ) ) {
            $guests = get_posts( [
                'post_type'      => 'guest_author',
                'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
                'posts_per_page' => -1,
                'orderby'        => 'title',
                'order'          => 'ASC',
            ] );
            foreach ( $guests as $guest ) {
                $suggestions[] = get_the_title( $guest );
            }
        }
        foreach ( get_users( [ 'orderby' => 'display_name', 'fields' => [ 'display_name' ] ] ) as $user ) {
            $suggestions[] = $user->display_name;
        }

        // De-duplicate case-insensitively and ignoring stray whitespace.
        $unique = [];
        foreach ( $suggestions as $name ) {
            $name = trim( preg_replace( '/\s+/', ' ', (string) $name ) );
            if ( '' === $name ) continue;
            $key = mb_strtolower( $name );
            if ( ! isset( $unique[ $key ] ) ) {
                $unique[ $key ] = $name;
            }
        }
        $suggestions = array_values( $unique );
        ?>
        <p>
            <input type="text" name="ad_byline" value="<?php echo esc_attr( $byline ); ?>"
                   list="ad-byline-suggestions" style="width:100%;"
                   placeholder="<?php esc_attr_e( 'e.g. Jeff Porchak', 'article-duplicator' ); ?>">
            <datalist id="ad-byline-suggestions">
                <?php foreach ( $suggestions as $name ) : ?>
                <option value="<?php echo esc_attr( $name ); ?>"></option>
                <?php endforeach; ?>
            </datalist>
        </p>
        <p class="description"><?php _e( 'The author name shown on the article. Type any name or pick a suggestion. Leave empty to show the WordPress account owner.', 'article-duplicator' ); ?></p>
        <?php
    }

    public function save_meta_box( $post_id ) {
        if ( ! isset( $_POST['ad_byline_nonce'] ) || ! wp_verify_nonce( $_POST['ad_byline_nonce'], 'ad_byline_meta' ) ) return;
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        $byline = sanitize_text_field( wp_unslash( $_POST['ad_byline'] ?? '' ) );

        if ( '' !== $byline ) {
            update_post_meta( $post_id, self::META_KEY, $byline );
            update_post_meta( $post_id, 'guest_author', $byline );
        } else {
            delete_post_meta( $post_id, self::META_KEY );
            delete_post_meta( $post_id, 'guest_author' );
        }
    }
}
