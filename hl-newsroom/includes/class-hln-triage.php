<?php
/**
 * HLN_Triage — the pre-ingestion analysis gate (spec §10).
 *
 * Stage A: lightweight, rule-based checks against every processed or
 * quarantined intake-log row (unclassified rows never reach this class —
 * Phase 2/3 already keep those out). Anything failing Stage A is marked
 * discarded on its existing hln_intake_log row for audit and never
 * becomes a Story Candidate.
 *
 * Stage B: rows that clear Stage A become a full hln_candidate post via
 * HLN_Candidate_CPT::create_from_intake_row(), then get an exact-URL
 * dedup pass (HLN_Dedup's fuzzy near-duplicate pass runs separately,
 * after the candidate exists, since it needs to compare against other
 * candidates too).
 *
 * Kill switch (service-level, not just UI — see HLN_Kill_Switch): a row
 * whose source is killed (globally or per-source) is left untouched —
 * not discarded, not promoted — so it's picked up normally on a future
 * run once the switch is lifted, rather than being lost.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Triage {

	const BATCH_SIZE = 25;
	const MIN_EXCERPT_LENGTH = 15;

	public function __construct() {
		add_action( 'init', [ $this, 'ensure_schedule' ] );
		add_action( 'hln_triage_run', [ $this, 'run' ] );
	}

	public function ensure_schedule() {
		if ( ! wp_next_scheduled( 'hln_triage_run' ) ) {
			wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( '5m' ), 'hln_triage_run' );
		}
	}

	public function run() {
		foreach ( HLN_Intake_Log::get_untriaged( self::BATCH_SIZE ) as $row ) {
			$this->process_row( $row );
		}
	}

	private function process_row( $row ) {
		if ( HLN_Kill_Switch::blocks_automatic_advancement( $row->source_slug ) ) {
			return; // Left as-is; picked up on a future run once the switch lifts.
		}

		$reason = $this->stage_a_reason( $row );
		if ( $reason ) {
			HLN_Intake_Log::set_status( $row->id, HLN_Intake_Log::STATUS_DISCARDED );
			return;
		}

		$candidate_id = HLN_Candidate_CPT::create_from_intake_row( $row );
		if ( is_wp_error( $candidate_id ) ) {
			return;
		}

		HLN_Intake_Log::link_candidate( $row->id, $candidate_id );

		// Exact-URL duplicate check against the archive and other
		// candidates — the cheap Stage A style check. HLN_Dedup's
		// broader fuzzy pass (entity + near-duplicate headline) runs
		// separately on a schedule once the candidate exists.
		HLN_Dedup::exact_url_check( $candidate_id );
	}

	/**
	 * @param  object $row
	 * @return string|null Reason for rejection, or null if it passes.
	 */
	private function stage_a_reason( $row ) {
		if ( empty( trim( (string) $row->headline ) ) ) {
			return 'Missing headline.';
		}
		if ( mb_strlen( trim( (string) $row->body_excerpt ) ) < self::MIN_EXCERPT_LENGTH && 'quarantined' !== $row->status ) {
			// Quarantined stewards items can be legitimately terse
			// (e.g. a single-line suspension notice) — don't discard
			// them for brevity; their generation is already blocked by
			// requires_source_clearance regardless.
			return 'Excerpt too short to be usable.';
		}
		if ( empty( $row->published_at ) && empty( $row->ingested_at ) ) {
			return 'No usable date.';
		}
		if ( ! empty( $row->original_url ) && $this->url_already_a_candidate( $row->original_url, $row->id ) ) {
			return 'Exact URL already promoted to a candidate.';
		}

		return null;
	}

	private function url_already_a_candidate( $url, $exclude_row_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_intake_log';
		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM $table WHERE original_url = %s AND candidate_id IS NOT NULL AND id != %d LIMIT 1",
			$url, $exclude_row_id
		) );
		return (bool) $existing;
	}
}
