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
       TRACK REGISTRY
       Each track has up to two codes:
         - replay code: Roberts Stream's tc= value (verified by playing
           a replay — NOT the same code system as USTA)
         - USTA code: used by m.ustrotting.com entries & results pages
       Built-in defaults merged with the editable Settings list, one
       per line: REPLAY|Track Name|USTA (replay may be left blank).
    ========================================================= */

    /**
     * USTA codes sourced from the live track dropdown on
     * m.ustrotting.com/entriesandresults. Replay codes are filled in
     * only once verified with the preview player.
     */
    public static function default_registry() {
        $rows = [
            // [ label, usta_code, replay_code ]
            [ 'The Meadows',            'Mea',   'MEE' ],
            [ 'PRD',                    '',      'PRD' ],
            [ 'Meadowlands',            'M',     '' ],
            [ 'Yonkers Raceway',        'YR',    '' ],
            [ 'Northfield Park',        'Nfld',  '' ],
            [ 'Hoosier Park',           'HoP',   '' ],
            [ "Harrah's Philadelphia",  'Phl',   '' ],
            [ 'Harrington Raceway',     'Har',   '' ],
            [ 'Monticello Raceway',     'MR',    '' ],
            [ 'Ocean Downs',            'OD',    '' ],
            [ 'Plainridge Park',        'PRc',   '' ],
            [ 'Pocono Downs',           'PcD',   '' ],
            [ 'Running Aces',           'Aces',  '' ],
            [ 'Saratoga Harness',       'Stga',  '' ],
            [ 'Scioto Downs',           'ScD',   '' ],
            [ 'Tioga Downs',            'TgDn',  '' ],
            [ 'Vernon Downs',           'VD',    '' ],
            [ 'Buffalo Raceway',        'BR',    '' ],
            [ 'Bangor Raceway',         'Bang',  '' ],
            [ 'Cumberland Raceway',     'CUMB',  '' ],
            [ 'Gaitway Farm',           'Gty',   '' ],
            [ 'Oak Grove',              'OakGr', '' ],
            [ 'Springfield',            'Spr',   '' ],
            [ 'Converse',               'Cnvr',  '' ],
            [ 'Croswell',               'Crswl', '' ],
            [ 'LaCenter',               'Lcnt',  '' ],
            [ 'Nashua',                 'Nash',  '' ],
            [ 'Paulding',               'Pauld', '' ],
            [ 'West Liberty',           'WstLb', '' ],
        ];

        $entries = [];
        foreach ( $rows as $row ) {
            $entries[] = [ 'label' => $row[0], 'usta' => $row[1], 'replay' => strtoupper( $row[2] ) ];
        }
        return $entries;
    }

    public static function track_registry() {
        $entries = self::default_registry();

        foreach ( preg_split( '/\r\n|\r|\n/', (string) get_option( 'ad_replay_tracks', '' ) ) as $line ) {
            $line = trim( $line );
            if ( '' === $line ) continue;

            $parts  = array_map( 'trim', explode( '|', $line, 3 ) );
            $replay = strtoupper( $parts[0] );
            $label  = $parts[1] ?? '';
            $usta   = $parts[2] ?? '';

            // Legacy two-field format CODE|Name.
            if ( '' === $label && '' !== $replay ) {
                $label = $replay;
            }
            if ( '' === $replay && '' === $label ) continue;

            // Merge into an existing entry (by replay code or name) or append.
            $matched = false;
            foreach ( $entries as &$entry ) {
                $same_replay = '' !== $replay && $entry['replay'] === $replay;
                $same_label  = '' !== $label && 0 === strcasecmp( $entry['label'], $label );
                if ( $same_replay || $same_label ) {
                    if ( '' !== $replay ) $entry['replay'] = $replay;
                    if ( '' !== $label )  $entry['label']  = $label;
                    if ( '' !== $usta )   $entry['usta']   = $usta;
                    $matched = true;
                    break;
                }
            }
            unset( $entry );

            if ( ! $matched ) {
                $entries[] = [ 'label' => $label, 'usta' => $usta, 'replay' => $replay ];
            }
        }

        return $entries;
    }

    /**
     * Find a track entry by replay code, USTA code or name.
     */
    public static function find_track( $input ) {
        $needle = mb_strtolower( trim( (string) $input ) );
        if ( '' === $needle ) return null;

        foreach ( self::track_registry() as $entry ) {
            if ( mb_strtolower( $entry['replay'] ) === $needle
              || mb_strtolower( $entry['usta'] ) === $needle
              || mb_strtolower( $entry['label'] ) === $needle ) {
                return $entry;
            }
        }
        return null;
    }

    /**
     * Back-compat map of replay code => label (replay-capable tracks only).
     */
    public static function get_tracks() {
        $tracks = [];
        foreach ( self::track_registry() as $entry ) {
            if ( '' !== $entry['replay'] ) {
                $tracks[ $entry['replay'] ] = $entry['label'];
            }
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

        // Replay-capable tracks first (their code works in the player);
        // USTA-only tracks listed after for results links.
        $suggestions = [];
        foreach ( self::track_registry() as $entry ) {
            if ( '' !== $entry['replay'] ) {
                $suggestions[ $entry['replay'] ] = $entry['label'];
            }
        }
        foreach ( self::track_registry() as $entry ) {
            if ( '' === $entry['replay'] && '' !== $entry['usta'] ) {
                $suggestions[ $entry['usta'] ] = $entry['label'] . ' ' . __( '(results only — replay code unverified)', 'article-duplicator' );
            }
        }
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
                <?php foreach ( $suggestions as $code => $label ) : ?>
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
        <p>
            <button type="button" class="button" id="ad-replay-find-btn"><?php _e( 'Find race', 'article-duplicator' ); ?></button>
            <button type="button" class="button" id="ad-replay-preview-btn"><?php _e( 'Preview replay', 'article-duplicator' ); ?></button>
            <button type="button" class="button" id="ad-replay-embed-btn"><?php _e( 'Embed', 'article-duplicator' ); ?></button>
            <button type="button" class="button" id="ad-replay-results-btn"><?php _e( 'Results link', 'article-duplicator' ); ?></button>
        </p>
        <div id="ad-replay-races" style="margin:6px 0;"></div>
        <p class="description"><?php _e( '<strong>Embed</strong> copies the replay shortcode to your clipboard — paste it anywhere in the article to place the player there instead of at the end. <strong>Results link</strong> copies a shortcode that renders a permanent link to the day\'s USTA results for this track.', 'article-duplicator' ); ?></p>

        <script>
        (function(){
            function val(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
            function fields(){
                return {
                    d: val('ad-replay-date'),
                    t: val('ad-replay-track').toUpperCase(),
                    r: val('ad-replay-race')
                };
            }
            function adCopy(text, btn){
                var done = function(){
                    var old = btn.textContent;
                    btn.textContent = '<?php echo esc_js( __( 'Copied!', 'article-duplicator' ) ); ?>';
                    setTimeout(function(){ btn.textContent = old; }, 1500);
                };
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text).then(done);
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                    document.body.appendChild(ta); ta.select();
                    try { document.execCommand('copy'); done(); } catch (e) {}
                    document.body.removeChild(ta);
                }
            }

            var previewBtn = document.getElementById('ad-replay-preview-btn');
            if (previewBtn) previewBtn.addEventListener('click', function(){
                var v = fields(), box = document.getElementById('ad-replay-preview');
                if (!v.d || !v.t || !v.r) { box.innerHTML = '<em><?php echo esc_js( __( 'Enter date, track and race first.', 'article-duplicator' ) ); ?></em>'; return; }
                var src = 'https://replays.robertsstream.com/racereplays/echoplay/replay.php'
                        + '?d=' + encodeURIComponent(v.d) + '&r=' + encodeURIComponent(v.r)
                        + '&tc=' + encodeURIComponent(v.t)
                        + '&cust=<?php echo esc_js( rawurlencode( get_option( 'ad_replay_cust', 'HarnessLink' ) ?: 'HarnessLink' ) ); ?>&width=800';
                // 4:3 letterbox container so the whole frame is visible, never cropped.
                box.innerHTML = '<div style="position:relative;padding-bottom:75%;height:0;background:#000;overflow:hidden;">'
                              + '<iframe src="' + src + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" scrolling="no" allowfullscreen></iframe>'
                              + '</div>';
            });

            var embedBtn = document.getElementById('ad-replay-embed-btn');
            if (embedBtn) embedBtn.addEventListener('click', function(){
                var v = fields();
                if (!v.d || !v.t || !v.r) { alert('<?php echo esc_js( __( 'Enter date, track and race first.', 'article-duplicator' ) ); ?>'); return; }
                adCopy('[race_replay date="' + v.d + '" track="' + v.t + '" race="' + v.r + '"]', this);
            });

            var resultsBtn = document.getElementById('ad-replay-results-btn');
            if (resultsBtn) resultsBtn.addEventListener('click', function(){
                var v = fields();
                if (!v.d || !v.t) { alert('<?php echo esc_js( __( 'Enter date and track first.', 'article-duplicator' ) ); ?>'); return; }
                adCopy('[race_results date="' + v.d + '" track="' + v.t + '"' + (v.r ? ' race="' + v.r + '"' : '') + ']', this);
            });

            var findBtn = document.getElementById('ad-replay-find-btn');
            if (findBtn) findBtn.addEventListener('click', function(){
                var v = fields(), box = document.getElementById('ad-replay-races');
                if (!v.d || !v.t) { alert('<?php echo esc_js( __( 'Enter date and track first.', 'article-duplicator' ) ); ?>'); return; }
                findBtn.disabled = true;
                box.textContent = '<?php echo esc_js( __( 'Looking up the day\'s card…', 'article-duplicator' ) ); ?>';
                var body = new URLSearchParams({
                    action: 'ad_find_races',
                    nonce:  '<?php echo esc_js( wp_create_nonce( 'ad_nonce' ) ); ?>',
                    date:   v.d,
                    track:  v.t
                });
                fetch('<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'same-origin',
                    body: body.toString()
                }).then(function(r){ return r.json(); }).then(function(res){
                    findBtn.disabled = false;
                    if (!res.success) { box.textContent = (res.data && res.data.message) || '<?php echo esc_js( __( 'Lookup failed.', 'article-duplicator' ) ); ?>'; return; }
                    box.innerHTML = '';
                    res.data.races.forEach(function(rc){
                        var b = document.createElement('button');
                        b.type = 'button';
                        b.className = 'button';
                        b.style.cssText = 'display:block;width:100%;margin:2px 0;text-align:left;white-space:normal;';
                        b.textContent = '<?php echo esc_js( __( 'Race', 'article-duplicator' ) ); ?> ' + rc.race + ' — ' + rc.winner;
                        b.addEventListener('click', function(){
                            document.getElementById('ad-replay-race').value = rc.race;
                            box.innerHTML = '';
                        });
                        box.appendChild(b);
                    });
                }).catch(function(){
                    findBtn.disabled = false;
                    box.textContent = '<?php echo esc_js( __( 'Request failed.', 'article-duplicator' ) ); ?>';
                });
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
     * replay meta. The article date is used as race date. The race number
     * comes from explicit "Race N" text, or failing that, from matching
     * the horses the article mentions against the USTA day card. Only
     * fires when a configured track matches — it never guesses.
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

        $track = null;
        foreach ( self::track_registry() as $entry ) {
            if ( '' === $entry['replay'] ) continue; // replay needs a verified player code
            if ( $entry['label'] !== $entry['replay'] && false !== stripos( $haystack, $entry['label'] ) ) {
                $track = $entry;
                break;
            }
            if ( strlen( $entry['replay'] ) >= 2 && preg_match( '/\b' . preg_quote( $entry['replay'], '/' ) . '\b/', $haystack ) ) {
                $track = $entry;
                break;
            }
        }
        if ( ! $track ) {
            return false;
        }

        $date = get_the_date( 'Y-m-d', $post_id );
        if ( ! $date ) {
            return false;
        }

        $race = 0;
        if ( preg_match( '/\brace\s*(?:no\.?|number|#)?\s*(\d{1,2})\b/i', $haystack, $m ) ) {
            $race = absint( $m[1] );
        }
        if ( ! $race && class_exists( 'AD_Results' ) ) {
            $race = AD_Results::find_race_by_horses( $track, $date, $haystack );
        }
        if ( ! $race ) {
            return false;
        }

        update_post_meta( $post_id, self::META_DATE,  $date );
        update_post_meta( $post_id, self::META_TRACK, $track['replay'] );
        update_post_meta( $post_id, self::META_RACE,  $race );

        return true;
    }
}
