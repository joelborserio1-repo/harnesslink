<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * USTA race results links (m.ustrotting.com).
 *
 * The desktop USTA results site keeps its state in server-side session
 * (no permanent URLs, and its generated links expire within 30 days).
 * The mobile site is linkable: each day's card at a track lives at
 *
 *   https://m.ustrotting.com/entriesandresults/racecardbytrack.cfm?race_card_id=NNNNN
 *
 * but the race_card_id is opaque. This class discovers it by POSTing the
 * track's USTA code to tracklist.cfm (the same request the mobile site's
 * own track picker makes), matching the wanted date in the returned list,
 * and caching the resolved URL so each track/date is looked up only once.
 */
class AD_Results {

    const BASE = 'https://m.ustrotting.com/entriesandresults/';

    public function __construct() {
        add_shortcode( 'race_results', [ $this, 'shortcode' ] );
    }

    /**
     * [race_results date="2026-06-10" track="MEE" race="3" text="..."]
     * track accepts a replay code, USTA code or track name.
     */
    public function shortcode( $atts ) {
        $atts = shortcode_atts( [
            'date'  => '',
            'track' => '',
            'race'  => '',
            'text'  => '',
        ], $atts, 'race_results' );

        $entry = AD_Replays::find_track( $atts['track'] );
        $url   = self::resolve_card_url( $entry, $atts['date'] );
        if ( '' === $url ) {
            return '';
        }

        $label = $entry['label'] ?? $atts['track'];
        $race  = absint( $atts['race'] );
        $text  = $atts['text'];

        if ( '' === $text ) {
            $when = date_i18n( get_option( 'date_format', 'F j, Y' ), strtotime( $atts['date'] ) );
            $text = sprintf( __( 'Full results: %s — %s', 'article-duplicator' ), $label, $when );
            if ( $race ) {
                $text .= sprintf( __( ' (Race %d)', 'article-duplicator' ), $race );
            }
        }

        return '<a class="ad-results-link" href="' . esc_url( $url ) . '" target="_blank" rel="noopener">' . esc_html( $text ) . '</a>';
    }

    /**
     * Resolve the permanent day-card URL for a track + date (Y-m-d or any
     * strtotime-able string). Returns '' when it can't be resolved.
     */
    public static function resolve_card_url( $entry, $date ) {
        $usta = is_array( $entry ) ? trim( $entry['usta'] ?? '' ) : '';
        $ts   = $date ? strtotime( $date ) : 0;
        if ( '' === $usta || ! $ts ) {
            return '';
        }
        $day = date( 'Y-m-d', $ts );

        $cache_key = 'ad_results_' . md5( $usta . '|' . $day );
        $cached    = get_transient( $cache_key );
        if ( false !== $cached ) {
            return is_string( $cached ) && 'none' !== $cached ? $cached : '';
        }

        $response = wp_remote_post( self::BASE . 'tracklist.cfm', [
            'timeout'    => 20,
            'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'body'       => [ 'track_code' => $usta ],
        ] );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            // Negative-cache briefly so a flaky lookup doesn't fire on every page view.
            set_transient( $cache_key, 'none', 15 * MINUTE_IN_SECONDS );
            return '';
        }

        $body = wp_remote_retrieve_body( $response );
        $url  = self::match_card_url( $body, $ts );

        // Card IDs are permanent once found; unresolved dates get a short
        // negative cache (the card may simply not be posted yet).
        set_transient( $cache_key, $url ?: 'none', $url ? 30 * DAY_IN_SECONDS : HOUR_IN_SECONDS );

        return $url;
    }

    /**
     * Pick the card link matching the wanted date out of the track page,
     * preferring the regular card over a qualifier "(Qua)" card.
     */
    private static function match_card_url( $html, $want_ts ) {
        if ( ! preg_match_all(
            '#href="(/entriesandresults/racecardbytrack\.cfm\?race_card_id=\d+)"(.{0,600}?)</a>#is',
            (string) $html, $matches, PREG_SET_ORDER
        ) ) {
            return '';
        }

        $want = date( 'Y-m-d', $want_ts );
        $best = '';

        foreach ( $matches as $m ) {
            $block = html_entity_decode( wp_strip_all_tags( $m[2] ) );
            if ( ! preg_match( '/\b\w+day,\s+\w+\s+\d{1,2},\s+\d{4}/', $block, $dm ) ) {
                continue;
            }
            $found_ts = strtotime( $dm[0] );
            if ( ! $found_ts || date( 'Y-m-d', $found_ts ) !== $want ) {
                continue;
            }

            $is_qualifier = false !== stripos( $block, '(Qua)' );
            if ( ! $is_qualifier ) {
                return 'https://m.ustrotting.com' . $m[1];
            }
            if ( '' === $best ) {
                $best = 'https://m.ustrotting.com' . $m[1];
            }
        }

        return $best;
    }
}
