<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Race replay embeds (Roberts Stream).
 *
 * Replays are served from replays.robertsstream.com and are addressed by
 * race date (d), race number (r) and track code (tc):
 *
 *   //replays.robertsstream.com/racereplays/echoplay/replay.php
 *       ?d=2026-06-09&r=8&tc=PRD&cust=HarnessLink&width=800
 *
 * The importer sanitises post content with wp_kses_post(), which strips
 * <iframe> tags, so replay params are stored as post meta and the player
 * is rendered on the front end via the_content. A [race_replay] shortcode
 * is also provided for manual placement.
 */
class AD_Replays {

    const META_DATE  = '_ad_replay_date';
    const META_TRACK = '_ad_replay_track';
    const META_RACE  = '_ad_replay_race';

    public function __construct() {
        add_shortcode( 'race_replay', [ $this, 'shortcode' ] );
        add_shortcode( 'hl_replay',   [ $this, 'shortcode' ] );

        add_action( 'add_meta_boxes', [ $this, 'register_meta_box' ] );
        add_action( 'save_post',      [ $this, 'save_meta_box' ] );
        add_filter( 'the_content',    [ $this, 'append_replay_to_content' ], 20 );
    }

    /* =========================================================
       URL / EMBED BUILDING
    ========================================================= */

    public static function build_url( $date, $race, $track, $width = 800 ) {
        $date  = sanitize_text_field( $date );
        $race  = absint( $race );
        $track = strtoupper( sanitize_text_field( $track ) );
        $cust  = get_option( 'ad_replay_cust', 'HarnessLink' ) ?: 'HarnessLink';

        if ( empty( $date ) || empty( $race ) || empty( $track ) ) {
            return '';
        }

        return add_query_arg( [
            'd'     => $date,
            'r'     => $race,
            'tc'    => $track,
            'cust'  => $cust,
            'width' => absint( $width ) ?: 800,
        ], 'https://replays.robertsstream.com/racereplays/echoplay/replay.php' );
    }

    public static function build_embed( $date, $race, $track, $width = 800, $height = 600 ) {
        $url = self::build_url( $date, $race, $track, $width );
        if ( empty( $url ) ) {
            return '';
        }

        return sprintf(
            '<div class="ad-replay-embed" style="max-width:%1$dpx;"><div style="position:relative;padding-bottom:75%%;height:0;overflow:hidden;">'
            . '<iframe src="%2$s" style="position:absolute;top:0;left:0;width:100%%;height:100%%;" width="%1$d" height="%3$d" frameborder="0" scrolling="no" allowfullscreen="allowfullscreen" loading="lazy" title="%4$s"></iframe>'
            . '</div></div>',
            absint( $width ) ?: 800,
            esc_url( $url ),
            absint( $height ) ?: 600,
            esc_attr__( 'Race replay', 'article-duplicator' )
        );
    }

    /* =========================================================
       SHORTCODE
       [race_replay date="2026-06-09" track="PRD" race="8"]
    ========================================================= */

    public function shortcode( $atts ) {
        $atts = shortcode_atts( [
            'date'   => '',
            'track'  => '',
            'race'   => '',
            'width'  => 800,
            'height' => 600,
        ], $atts, 'race_replay' );

        return self::build_embed( $atts['date'], $atts['race'], $atts['track'], $atts['width'], $atts['height'] );
    }

    /* =========================================================
       TRACK LIST (configured in Settings)
       One per line: CODE|Track Name  e.g.  PRD|Prairie Downs
    ========================================================= */

    public static function get_tracks() {
        $raw    = (string) get_option( 'ad_replay_tracks', '' );
        $tracks = [];

        foreach ( preg_split( '/\r\n|\r|\n/', $raw ) as $line ) {
            $line = trim( $line );
            if ( '' === $line ) continue;

            $parts = array_map( 'trim', explode( '|', $line, 2 ) );
            $code  = strtoupper( $parts[0] );
            if ( '' === $code ) continue;

            $tracks[ $code ] = $parts[1] ?? $code;
        }

        return $tracks;
    }

    /* =========================================================
       META BOX (post + imported article edit screens)
    ========================================================= */

    public function register_meta_box() {
        $screens = array_unique( [ 'post', AD_CPT::POST_TYPE, get_option( 'ad_post_type', AD_CPT::POST_TYPE ) ] );
        foreach ( $screens as $screen ) {
            add_meta_box(
                'ad-replay-box',
                __( 'Race Replay', 'article-duplicator' ),
                [ $this, 'render_meta_box' ],
                $screen,
                'side',
                'default'
            );
        }
    }

    public function render_meta_box( $post ) {
        wp_nonce_field( 'ad_replay_meta', 'ad_replay_nonce' );

        $date  = get_post_meta( $post->ID, self::META_DATE,  true ) ?: get_the_date( 'Y-m-d', $post );
        $track = get_post_meta( $post->ID, self::META_TRACK, true );
        $race  = get_post_meta( $post->ID, self::META_RACE,  true );
        $tracks = self::get_tracks();
        ?>
        <p>
            <label for="ad-replay-date"><strong><?php _e( 'Race date', 'article-duplicator' ); ?></strong></label><br>
            <input type="date" id="ad-replay-date" name="ad_replay_date" value="<?php echo esc_attr( $date ); ?>" style="width:100%;">
        </p>
        <p>
            <label for="ad-replay-track"><strong><?php _e( 'Track code', 'article-duplicator' ); ?></strong></label><br>
            <input type="text" id="ad-replay-track" name="ad_replay_track" value="<?php echo esc_attr( $track ); ?>"
                   list="ad-replay-track-list" placeholder="<?php esc_attr_e( 'e.g. PRD', 'article-duplicator' ); ?>"
                   style="width:100%;text-transform:uppercase;">
            <datalist id="ad-replay-track-list">
                <?php foreach ( $tracks as $code => $label ) : ?>
                <option value="<?php echo esc_attr( $code ); ?>"><?php echo esc_html( $label ); ?></option>
                <?php endforeach; ?>
            </datalist>
        </p>
        <p>
            <label for="ad-replay-race"><strong><?php _e( 'Race number', 'article-duplicator' ); ?></strong></label><br>
            <input type="number" id="ad-replay-race" name="ad_replay_race" value="<?php echo esc_attr( $race ); ?>" min="1" max="30" style="width:100%;">
        </p>
        <p class="description"><?php _e( 'Fill in all three fields and the replay player is added automatically at the end of the article. Leave the race number empty to remove it.', 'article-duplicator' ); ?></p>

        <div id="ad-replay-preview" style="margin-top:8px;"></div>
        <button type="button" class="button" id="ad-replay-preview-btn"><?php _e( 'Preview replay', 'article-duplicator' ); ?></button>

        <script>
        (function(){
            var btn = document.getElementById('ad-replay-preview-btn');
            if (!btn) return;
            btn.addEventListener('click', function(){
                var d = document.getElementById('ad-replay-date').value,
                    t = document.getElementById('ad-replay-track').value.toUpperCase(),
                    r = document.getElementById('ad-replay-race').value,
                    box = document.getElementById('ad-replay-preview');
                if (!d || !t || !r) { box.innerHTML = '<em><?php echo esc_js( __( 'Enter date, track and race first.', 'article-duplicator' ) ); ?></em>'; return; }
                var src = 'https://replays.robertsstream.com/racereplays/echoplay/replay.php'
                        + '?d=' + encodeURIComponent(d) + '&r=' + encodeURIComponent(r)
                        + '&tc=' + encodeURIComponent(t)
                        + '&cust=<?php echo esc_js( rawurlencode( get_option( 'ad_replay_cust', 'HarnessLink' ) ?: 'HarnessLink' ) ); ?>&width=800';
                box.innerHTML = '<iframe src="' + src + '" style="width:100%;height:220px;border:0;" scrolling="no" allowfullscreen></iframe>';
            });
        })();
        </script>
        <?php
    }

    public function save_meta_box( $post_id ) {
        if ( ! isset( $_POST['ad_replay_nonce'] ) || ! wp_verify_nonce( $_POST['ad_replay_nonce'], 'ad_replay_meta' ) ) return;
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        $date  = sanitize_text_field( $_POST['ad_replay_date'] ?? '' );
        $track = strtoupper( sanitize_text_field( $_POST['ad_replay_track'] ?? '' ) );
        $race  = absint( $_POST['ad_replay_race'] ?? 0 );

        if ( $date && $track && $race ) {
            update_post_meta( $post_id, self::META_DATE,  $date );
            update_post_meta( $post_id, self::META_TRACK, $track );
            update_post_meta( $post_id, self::META_RACE,  $race );
        } else {
            delete_post_meta( $post_id, self::META_DATE );
            delete_post_meta( $post_id, self::META_TRACK );
            delete_post_meta( $post_id, self::META_RACE );
        }
    }

    /* =========================================================
       FRONT END
    ========================================================= */

    public function append_replay_to_content( $content ) {
        if ( ! is_singular() || ! in_the_loop() || ! is_main_query() ) {
            return $content;
        }

        // Skip when the editor already placed a shortcode manually.
        if ( has_shortcode( $content, 'race_replay' ) || has_shortcode( $content, 'hl_replay' ) ) {
            return $content;
        }

        $post_id = get_the_ID();
        $date    = get_post_meta( $post_id, self::META_DATE,  true );
        $track   = get_post_meta( $post_id, self::META_TRACK, true );
        $race    = get_post_meta( $post_id, self::META_RACE,  true );

        $embed = self::build_embed( $date, $race, $track );
        if ( empty( $embed ) ) {
            return $content;
        }

        return $content
            . '<h3 class="ad-replay-heading">' . esc_html__( 'Race Replay', 'article-duplicator' ) . '</h3>'
            . $embed;
    }

    /* =========================================================
       IMPORT-TIME AUTO ATTACH (best effort)
    ========================================================= */

    /**
     * Try to detect track + race number from scraped text and attach the
     * replay meta. The article date is used as race date. Only fires when
     * a configured track name or code matches, so it never guesses.
     */
    public static function maybe_attach_to_import( $post_id, array $article_data ) {
        if ( ! get_option( 'ad_replay_auto', '1' ) ) {
            return false;
        }

        $haystack = wp_strip_all_tags(
            ( $article_data['title'] ?? '' ) . ' ' .
            ( $article_data['excerpt'] ?? '' ) . ' ' .
            ( $article_data['content'] ?? '' )
        );

        $track_code = '';
        foreach ( self::get_tracks() as $code => $label ) {
            if ( $label !== $code && false !== stripos( $haystack, $label ) ) {
                $track_code = $code;
                break;
            }
            if ( preg_match( '/\b' . preg_quote( $code, '/' ) . '\b/', $haystack ) ) {
                $track_code = $code;
                break;
            }
        }
        if ( '' === $track_code ) {
            return false;
        }

        if ( ! preg_match( '/\brace\s*(?:no\.?|number|#)?\s*(\d{1,2})\b/i', $haystack, $m ) ) {
            return false;
        }
        $race = absint( $m[1] );

        $date = get_the_date( 'Y-m-d', $post_id );
        if ( ! $date ) {
            return false;
        }

        update_post_meta( $post_id, self::META_DATE,  $date );
        update_post_meta( $post_id, self::META_TRACK, $track_code );
        update_post_meta( $post_id, self::META_RACE,  $race );

        return true;
    }
}
