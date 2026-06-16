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

    const META_KEY   = '_ad_guest_author'; // display name (front-end byline)
    const SELECT_KEY = '_ad_author_select'; // selection value: 'guest-{id}' | user id

    public function __construct() {
        // Priority PHP_INT_MAX so these run AFTER Molongui Authorship (and any
        // custom snippets), ensuring the selected byline is what displays in
        // Elementor's Post Info widget / theme author output.
        add_filter( 'the_author', [ $this, 'filter_the_author' ], PHP_INT_MAX );
        add_filter( 'get_the_author_display_name', [ $this, 'filter_display_name' ], PHP_INT_MAX, 2 );

        // Priority 20 so the core "Author" box is registered first, then removed.
        add_action( 'add_meta_boxes', [ $this, 'register_meta_box' ], 20 );
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
            // Remove the core "Author" box — its WP-user list is the old
            // feature that kept Harnesslink assigned. The guest author list
            // below is now the single author selector.
            remove_meta_box( 'authordiv', $screen, 'normal' );

            add_meta_box(
                'ad-byline-box',
                __( 'Author', 'article-duplicator' ),
                [ $this, 'render_meta_box' ],
                $screen,
                'side',
                'high'
            );
        }
    }

    /**
     * Best-effort: resolve the currently-stored selection value for the
     * dropdown. Prefers the saved selection key; otherwise matches the
     * stored byline name against a guest author so existing posts show
     * their author pre-selected.
     */
    private function current_selection( $post_id ) {
        $sel = (string) get_post_meta( $post_id, self::SELECT_KEY, true );
        if ( '' !== $sel ) {
            return $sel;
        }

        // Legacy: a Molongui pointer already on the post.
        $main = (string) get_post_meta( $post_id, '_molongui_main_author', true );
        if ( preg_match( '/^guest-(\d+)$/', $main ) ) {
            return $main;
        }

        // Fall back to matching the stored byline name to a guest author.
        $name = (string) get_post_meta( $post_id, self::META_KEY, true );
        if ( '' !== $name && post_type_exists( 'guest_author' ) ) {
            $hit = get_posts( [
                'post_type'      => 'guest_author',
                'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
                'title'          => $name,
                'posts_per_page' => 1,
                'fields'         => 'ids',
            ] );
            if ( ! empty( $hit ) ) {
                return 'guest-' . (int) $hit[0];
            }
        }

        return '';
    }

    public function render_meta_box( $post ) {
        wp_nonce_field( 'ad_byline_meta', 'ad_byline_nonce' );

        $selected = $this->current_selection( $post->ID );
        $byline   = get_post_meta( $post->ID, self::META_KEY, true );

        $guests = [];
        if ( post_type_exists( 'guest_author' ) ) {
            $guests = get_posts( [
                'post_type'      => 'guest_author',
                'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
                'posts_per_page' => -1,
                'orderby'        => 'title',
                'order'          => 'ASC',
            ] );
        }
        $users = get_users( [ 'orderby' => 'display_name', 'fields' => [ 'ID', 'display_name', 'user_login' ] ] );
        ?>
        <p>
            <select name="ad_author" style="width:100%;">
                <option value=""><?php esc_html_e( '— Select author —', 'article-duplicator' ); ?></option>
                <?php if ( $guests ) : ?>
                <optgroup label="<?php esc_attr_e( 'Authors', 'article-duplicator' ); ?>">
                    <?php foreach ( $guests as $guest ) : $val = 'guest-' . $guest->ID; ?>
                    <option value="<?php echo esc_attr( $val ); ?>" <?php selected( $selected, $val ); ?>><?php echo esc_html( get_the_title( $guest ) ); ?></option>
                    <?php endforeach; ?>
                </optgroup>
                <?php endif; ?>
                <optgroup label="<?php esc_attr_e( 'Site Users', 'article-duplicator' ); ?>">
                    <?php foreach ( $users as $user ) : ?>
                    <option value="<?php echo esc_attr( $user->ID ); ?>" <?php selected( $selected, (string) $user->ID ); ?>><?php echo esc_html( $user->display_name . ' (' . $user->user_login . ')' ); ?></option>
                    <?php endforeach; ?>
                </optgroup>
            </select>
        </p>
        <p class="description">
            <?php
            if ( '' !== $byline ) {
                printf(
                    /* translators: current byline */
                    esc_html__( 'Currently shown: %s. Pick an author from the list to change it.', 'article-duplicator' ),
                    '<strong>' . esc_html( $byline ) . '</strong>'
                );
            } else {
                esc_html_e( 'Choose who this article is published by. This is the author shown on the live site.', 'article-duplicator' );
            }
            ?>
        </p>

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
        if ( ! isset( $_POST['ad_author'] ) ) return;

        $value = sanitize_text_field( wp_unslash( $_POST['ad_author'] ) );

        update_post_meta( $post_id, self::SELECT_KEY, $value );

        // Apply byline meta + the real Molongui pointer so the chosen author
        // actually displays (the importer owns this logic).
        $importer = new AD_Importer();
        $importer->apply_author_selection( $post_id, $value );
    }
}
