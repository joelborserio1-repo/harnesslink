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

        <hr style="margin:12px 0;">
        <p>
            <button type="button" class="button" id="ad-reset-date-btn"><?php _e( 'Reset date to now', 'article-duplicator' ); ?></button>
        </p>
        <p class="description"><?php _e( 'Sets this post\'s date to the current time — useful for older imports pinned to the scrape date. Saves immediately and reloads the editor.', 'article-duplicator' ); ?></p>
        <script>
        (function(){
            var btn = document.getElementById('ad-reset-date-btn');
            if (!btn) return;
            btn.addEventListener('click', function(){
                if (!confirm('<?php echo esc_js( __( 'Set this post\'s date to now and reload? Unsaved changes in the editor will be lost.', 'article-duplicator' ) ); ?>')) return;
                btn.disabled = true;
                var body = new URLSearchParams({
                    action:  'ad_reset_date',
                    nonce:   '<?php echo esc_js( wp_create_nonce( 'ad_nonce' ) ); ?>',
                    post_id: '<?php echo (int) $post->ID; ?>'
                });
                fetch('<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString()
                }).then(function(r){ return r.json(); }).then(function(res){
                    if (res.success) { location.reload(); }
                    else { alert((res.data && res.data.message) || '<?php echo esc_js( __( 'Failed.', 'article-duplicator' ) ); ?>'); btn.disabled = false; }
                }).catch(function(){
                    alert('<?php echo esc_js( __( 'Request failed.', 'article-duplicator' ) ); ?>'); btn.disabled = false;
                });
            });
        })();
        </script>
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
