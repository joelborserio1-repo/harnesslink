<?php
/**
 * HLN_Race_Candidate_Link — the deterministic bridge between
 * hln_race_calendar and the Story Candidate pipeline.
 *
 * A calendar entry gets at most one Preview candidate and at most one
 * Result candidate, tracked directly via preview_candidate_id/
 * result_candidate_id on the hln_race_calendar row itself — not by
 * fuzzy-matching headlines. Both columns act as a duplicate-creation
 * guard: once set, this class never creates a second candidate for that
 * entry/story_type, it only leaves the existing link alone.
 *
 *   Feature Race Calendar -> Racing Intelligence -> Story Candidate -> Generate -> QC -> Review
 *
 * Trigger points (deterministic, not fuzzy):
 *   - Preview: the calendar entry's race_date falls within the upcoming
 *     preview window (configurable, default 3 days out) — this is the
 *     available proxy for "fields available," since this build's
 *     calendar extraction (Phase 2, best-effort/generic) does not
 *     currently capture a confirmed runner list per race.
 *   - Result: the calendar entry's race_date has passed, within a bounded
 *     lookback window (default 3 days) so stale/very old entries never
 *     spawn a result candidate.
 *
 * HLN_Story_Generator uses a candidate's race_calendar_id (when present)
 * to fetch racing intelligence directly by ID. The old fuzzy
 * headline/race-name match in that class is kept ONLY as a fallback for
 * candidates with no race_calendar_id — e.g. a news-channel candidate
 * that happens to be about a race but wasn't created through this class.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Race_Candidate_Link {

	public function __construct() {
		// Runs after HLN_Race_Data's calendar adapter (priority 10) and
		// HLN_Racing_Intelligence's assembly (priority 20), on the same
		// cron event, so racing intelligence is already available for
		// any candidate this class creates.
		add_action( 'hln_race_calendar_poll', [ $this, 'link_calendar_entries' ], 30 );
	}

	public function link_calendar_entries() {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_calendar';

		$preview_window = (int) get_option( 'hln_race_preview_window_days', 3 );
		$result_window  = (int) get_option( 'hln_race_result_window_days', 3 );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $table WHERE race_date BETWEEN %s AND %s",
			gmdate( 'Y-m-d', strtotime( "-{$result_window} days" ) ),
			gmdate( 'Y-m-d', strtotime( "+{$preview_window} days" ) )
		) );

		$today = current_time( 'Y-m-d' );

		foreach ( $rows as $row ) {
			if ( empty( $row->race_date ) ) {
				continue;
			}
			if ( HLN_Kill_Switch::blocks_automatic_advancement( $row->source_slug ) ) {
				continue; // Left unlinked; picked up on a future run once the switch lifts.
			}
			if ( $row->race_date >= $today && empty( $row->preview_candidate_id ) ) {
				$this->create_and_link( $row, 'preview', 'preview_candidate_id' );
			}
			if ( $row->race_date < $today && empty( $row->result_candidate_id ) ) {
				$this->create_and_link( $row, 'result', 'result_candidate_id' );
			}
		}
	}

	private function create_and_link( $calendar_row, $story_type, $column ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_calendar';

		$trust_score = $this->trust_score_for_source( $calendar_row->source_slug );
		$headline    = $this->build_headline( $calendar_row, $story_type );
		$excerpt     = $this->build_excerpt( $calendar_row, $story_type );

		$candidate_id = HLN_Candidate_CPT::create_from_calendar_row( $calendar_row, $story_type, $headline, $excerpt, $trust_score );
		if ( is_wp_error( $candidate_id ) ) {
			return;
		}

		// Guard the write with "column IS NULL" so a rare overlapping
		// cron run can't create two candidates for the same entry/type.
		$updated = $wpdb->query( $wpdb->prepare(
			"UPDATE $table SET $column = %d WHERE id = %d AND $column IS NULL",
			$candidate_id, $calendar_row->id
		) );

		if ( 0 === $updated ) {
			// Another run won the race — this candidate is now an
			// orphan duplicate; leave it for HLN_Dedup's fuzzy pass to
			// catch and demote rather than deleting it outright.
			HLN_Candidate_CPT::append_audit( $candidate_id, 'candidate_updated', 'Calendar link race lost — a candidate for this entry/type already existed.' );
		}
	}

	private function trust_score_for_source( $source_slug ) {
		$entry = HLN_Sources::get( 'official', $source_slug );
		return $entry['trust_score'] ?? 80;
	}

	private function build_headline( $calendar_row, $story_type ) {
		if ( 'preview' === $story_type ) {
			return sprintf( '%s: Preview', $calendar_row->race_name );
		}
		return sprintf( '%s: Result', $calendar_row->race_name );
	}

	private function build_excerpt( $calendar_row, $story_type ) {
		$parts = array_filter( [
			$calendar_row->race_name,
			$calendar_row->grade,
			$calendar_row->governing_body,
			$calendar_row->race_date,
			$calendar_row->prize_money ? 'purse ' . $calendar_row->prize_money : '',
		] );
		return implode( ' — ', $parts );
	}
}
