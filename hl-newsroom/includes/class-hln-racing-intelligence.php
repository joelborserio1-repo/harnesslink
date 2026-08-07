<?php
/**
 * HLN_Racing_Intelligence — assembles the racing-intelligence record for
 * a feature-race-calendar entry (spec §2.4.1).
 *
 * This class only assembles and stores structured data for the story
 * generator to draw on in Phase 5 — it produces no prose. Where a data
 * source genuinely doesn't exist yet in this build (barrier history,
 * speed/pace figures, a confirmed runner field for a given race), the
 * corresponding field is left as an honest empty array rather than
 * fabricated, and callers can backfill it later without a schema change.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Racing_Intelligence {

	const ARCHIVE_LOOKBACK_MONTHS = 24;

	public function __construct() {
		// Runs after HLN_Race_Data's calendar adapter on the same cron
		// event, so newly-upserted calendar rows are already in the table.
		add_action( 'hln_race_calendar_poll', [ $this, 'assemble_upcoming' ], 20 );
	}

	public function assemble_upcoming() {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_calendar';
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $table WHERE race_date IS NULL OR race_date >= %s ORDER BY race_date ASC LIMIT %d",
			current_time( 'Y-m-d' ), 50
		), ARRAY_A );

		foreach ( $rows as $row ) {
			$this->assemble_for_entry( (int) $row['id'], $row );
		}
	}

	/**
	 * @param  int      $calendar_entry_id
	 * @param  array    $calendar_row
	 * @param  string[] $field Runner names, if already known. Empty when
	 *                         no confirmed field exists yet for this race.
	 * @return array
	 */
	public function assemble_for_entry( $calendar_entry_id, array $calendar_row, array $field = [] ) {
		$payload = [
			'recent_performance'   => [],
			'barrier_history'      => [], // No data source for this yet — left empty rather than guessed.
			'trainer_driver_stats' => [],
			'prior_results'        => $this->find_prior_results( $calendar_row ),
			'form_data'            => [], // No data source for this yet.
			'speed_pace_figures'   => [], // No data source for this yet.
			'previous_winners'     => $this->find_previous_winners( $calendar_row ),
		];

		foreach ( $field as $runner ) {
			$payload['recent_performance'][ $runner ] = $this->find_recent_mentions( $runner );
			$payload['trainer_driver_stats'][ $runner ] = $this->find_recent_mentions( $runner, [ 'trainer', 'driver' ] );
		}

		$this->save( $calendar_entry_id, $payload );

		return $payload;
	}

	/* =========================================================
	   ARCHIVE CROSS-REFERENCE
	   Matches by title/content search against HarnessLink's own
	   published posts — the closest thing to an "entity watchlist"
	   available before Phase 4 formalises one from the archive.
	========================================================= */

	private function find_prior_results( array $calendar_row ) {
		if ( empty( $calendar_row['race_name'] ) ) {
			return [];
		}
		return $this->search_archive( $calendar_row['race_name'], 5 );
	}

	private function find_previous_winners( array $calendar_row ) {
		if ( empty( $calendar_row['race_name'] ) ) {
			return [];
		}
		// Best-effort proxy: the same archive search as prior_results.
		// Isolating the actual winner requires parsing each recap post's
		// content, which is out of scope for this phase's data assembly.
		return $this->search_archive( $calendar_row['race_name'] . ' wins', 5 );
	}

	private function find_recent_mentions( $entity, array $extra_terms = [] ) {
		$query = trim( $entity . ' ' . implode( ' ', $extra_terms ) );
		return $this->search_archive( $query, 5, self::ARCHIVE_LOOKBACK_MONTHS );
	}

	private function search_archive( $search_term, $limit = 5, $lookback_months = null ) {
		$args = [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			's'              => $search_term,
			'posts_per_page' => $limit,
			'orderby'        => 'date',
			'order'          => 'DESC',
			'no_found_rows'  => true,
		];

		if ( $lookback_months ) {
			$args['date_query'] = [ [ 'after' => gmdate( 'Y-m-d', strtotime( "-{$lookback_months} months" ) ) ] ];
		}

		$query   = new WP_Query( $args );
		$results = [];
		foreach ( $query->posts as $post ) {
			$results[] = [
				'post_id' => $post->ID,
				'title'   => get_the_title( $post ),
				'url'     => get_permalink( $post ),
				'date'    => get_the_date( 'Y-m-d', $post ),
			];
		}
		return $results;
	}

	/* =========================================================
	   PERSISTENCE
	========================================================= */

	private function save( $calendar_entry_id, array $payload ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_intelligence';

		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM $table WHERE calendar_entry_id = %d", $calendar_entry_id
		) );

		$fields = [
			'calendar_entry_id' => $calendar_entry_id,
			'payload'           => wp_json_encode( $payload ),
			'assembled_at'      => current_time( 'mysql' ),
		];

		if ( $existing ) {
			$wpdb->update( $table, $fields, [ 'id' => (int) $existing ] );
		} else {
			$wpdb->insert( $table, $fields );
		}
	}

	/**
	 * @param  int $calendar_entry_id
	 * @return array|null Decoded payload, or null if not yet assembled.
	 */
	public static function get_for_entry( $calendar_entry_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_intelligence';
		$row   = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM $table WHERE calendar_entry_id = %d", $calendar_entry_id
		), ARRAY_A );

		if ( ! $row ) {
			return null;
		}
		return json_decode( $row['payload'], true );
	}
}
