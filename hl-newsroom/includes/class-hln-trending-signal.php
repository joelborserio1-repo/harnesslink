<?php
/**
 * HLN_Trending_Signal — the separate, broader X scan from spec §15.
 *
 * Unlike HLN_X_Poller (spec §2.3), this is not limited to the verified
 * allow-list — its only job is detecting that a horse/trainer/race is
 * getting unusual attention right now. That is a signal, not a source.
 *
 * Hard constraint, enforced structurally rather than by convention: this
 * class only ever reads entities from the intake log (to build a rough
 * watchlist) and has no dependency on HLN_Intake_Log — the class that
 * knows how to write candidate rows — at all. Every write this class
 * performs goes to its own hln_trending_signal table. It is physically
 * incapable of creating a candidate or supplying a headline/body_excerpt/
 * entities/quote, not merely instructed not to.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Trending_Signal {

	const SCAN_FREQUENCY   = '30m';
	const LOOKBACK_DAYS    = 7;
	const MAX_TERMS_PER_SCAN = 20;
	const REQUEST_TIMEOUT   = 20;

	public function __construct() {
		add_action( 'init', [ $this, 'ensure_schedule' ] );
		add_action( 'hln_trending_signal_scan', [ $this, 'run_scan' ] );
	}

	public function ensure_schedule() {
		if ( ! wp_next_scheduled( 'hln_trending_signal_scan' ) ) {
			wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( self::SCAN_FREQUENCY ), 'hln_trending_signal_scan' );
		}
	}

	/* =========================================================
	   SCAN
	========================================================= */

	public function run_scan() {
		$token = get_option( 'hln_x_api_bearer_token', '' );
		if ( '' === $token ) {
			update_option( 'hln_trending_signal_status', [ 'last_run_at' => current_time( 'mysql' ), 'error' => 'X API bearer token is not configured.' ] );
			return; // Fail gracefully — no credentials, no guessing.
		}

		$terms = $this->build_watchlist_terms();
		if ( empty( $terms ) ) {
			update_option( 'hln_trending_signal_status', [ 'last_run_at' => current_time( 'mysql' ), 'error' => 'No watchlist terms available yet (no entities seen in the intake log).' ] );
			return;
		}

		$failures = 0;
		foreach ( $terms as $term ) {
			$result = $this->fetch_recent_count( $term, $token );
			if ( null === $result ) {
				$failures++;
				continue;
			}
			$this->record_signal( $term, $result );
		}

		update_option( 'hln_trending_signal_status', [
			'last_run_at' => current_time( 'mysql' ),
			'error'       => $failures === count( $terms ) ? 'Every term lookup failed — the X API may be unavailable.' : null,
		] );
	}

	/**
	 * Derives a lightweight watchlist from entities already seen across
	 * every intake channel in the last week — the closest thing to a
	 * formal watchlist available before Phase 4 builds one properly
	 * against the HarnessLink archive (spec §6).
	 *
	 * @return string[]
	 */
	private function build_watchlist_terms() {
		global $wpdb;
		// Reads entities from the intake log by table name only — this
		// class intentionally has no dependency on the HLN_Intake_Log
		// class itself, since that class also knows how to write rows.
		$table = $wpdb->prefix . 'hln_intake_log';
		$rows  = $wpdb->get_col( $wpdb->prepare(
			"SELECT entities FROM $table WHERE status = %s AND ingested_at >= %s AND entities IS NOT NULL LIMIT 300",
			'processed', gmdate( 'Y-m-d H:i:s', strtotime( '-' . self::LOOKBACK_DAYS . ' days' ) )
		) );

		$counts = [];
		foreach ( $rows as $json ) {
			$decoded = json_decode( $json, true );
			if ( ! is_array( $decoded ) ) {
				continue;
			}
			foreach ( $decoded as $value ) {
				if ( ! is_string( $value ) || mb_strlen( $value ) < 4 ) {
					continue; // Skips non-string entries too, e.g. the stewards_tags sub-array.
				}
				$counts[ $value ] = ( $counts[ $value ] ?? 0 ) + 1;
			}
		}

		arsort( $counts );
		return array_slice( array_keys( $counts ), 0, self::MAX_TERMS_PER_SCAN );
	}

	/* =========================================================
	   X API v2 — recent tweet counts
	========================================================= */

	/**
	 * @param  string $term
	 * @param  string $token
	 * @return array|null {sample_count, window_start, window_end}
	 */
	private function fetch_recent_count( $term, $token ) {
		$url = add_query_arg( [ 'query' => rawurlencode( $term ) ], 'https://api.x.com/2/tweets/counts/recent' );

		$response = wp_remote_get( $url, [
			'timeout' => self::REQUEST_TIMEOUT,
			'headers' => [ 'Authorization' => 'Bearer ' . $token ],
		] );

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$body    = json_decode( wp_remote_retrieve_body( $response ), true );
		$buckets = $body['data'] ?? [];
		if ( empty( $buckets ) ) {
			return null;
		}

		$total = 0;
		foreach ( $buckets as $bucket ) {
			$total += (int) ( $bucket['tweet_count'] ?? 0 );
		}

		return [
			'sample_count' => $total,
			'window_start' => isset( $buckets[0]['start'] ) ? gmdate( 'Y-m-d H:i:s', strtotime( $buckets[0]['start'] ) ) : null,
			'window_end'   => isset( $buckets[ count( $buckets ) - 1 ]['end'] ) ? gmdate( 'Y-m-d H:i:s', strtotime( $buckets[ count( $buckets ) - 1 ]['end'] ) ) : null,
		];
	}

	/* =========================================================
	   PERSISTENCE — hln_trending_signal only
	========================================================= */

	private function record_signal( $term, array $result ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_trending_signal';
		$wpdb->insert( $table, [
			'term'         => $term,
			'region'       => null,
			'sample_count' => $result['sample_count'],
			// Raw volume for this phase — Phase 4's trending computation
			// (spec §5.1) is what turns this into a weighted score
			// alongside source trust, recency, and corroboration.
			'signal_score' => $result['sample_count'],
			'window_start' => $result['window_start'],
			'window_end'   => $result['window_end'],
			'detected_at'  => current_time( 'mysql' ),
		] );
	}
}
