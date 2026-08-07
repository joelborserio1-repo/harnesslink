<?php
/**
 * HLN_Kill_Switch — centralised, service-level kill-switch checks.
 *
 * This build is 100% human-triggered today: nothing auto-promotes a
 * candidate to generation, and nothing auto-publishes. But the pipeline
 * is designed to grow more automated over time, so every stage that
 * could one day advance a candidate automatically checks this class
 * directly — not just the dashboard UI — so the switch has real teeth
 * the moment any future automation is added, rather than needing to be
 * retrofitted then.
 *
 * Checked today at:
 *   - HLN_Triage::process_row()      — blocks automatic Stage B
 *     promotion (intake -> candidate) for a killed source. The row is
 *     left untouched (not discarded, not promoted) and is picked up
 *     normally once the switch is lifted.
 *   - HLN_Story_Generator::generate_draft() — blocks automatic
 *     candidate -> generation advancement for a killed source.
 *
 * Deliberately NOT checked at the Publish action: Publish is an explicit
 * manual human click, and Hard Requirement 5 already guarantees a human
 * approved it — gating a human's own deliberate action behind the
 * automation kill switch would contradict "manual editorial actions may
 * remain available."
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Kill_Switch {

	/**
	 * @return bool
	 */
	public static function is_globally_engaged() {
		return (bool) get_option( 'hln_global_kill_switch', false );
	}

	/**
	 * @param  string $source_slug
	 * @return bool
	 */
	public static function is_source_engaged( $source_slug ) {
		if ( empty( $source_slug ) ) {
			return false;
		}
		$killed = get_option( 'hln_source_kill_switches', [] );
		return ! empty( $killed[ $source_slug ] );
	}

	/**
	 * @param  string|null $source_slug
	 * @return bool True if automatic advancement is blocked, globally or for this source.
	 */
	public static function blocks_automatic_advancement( $source_slug = null ) {
		if ( self::is_globally_engaged() ) {
			return true;
		}
		return self::is_source_engaged( $source_slug );
	}

	/**
	 * Resolve the source_slug behind a candidate — from its intake-log
	 * row when it has one, or from race_calendar_id -> hln_race_calendar
	 * when it was created directly from the feature-race calendar.
	 *
	 * @param  int $candidate_id
	 * @return string|null
	 */
	public static function source_slug_for_candidate( $candidate_id ) {
		global $wpdb;

		$log_id = HLN_Candidate_CPT::get_meta( $candidate_id, 'source_intake_log_id' );
		if ( $log_id ) {
			$slug = $wpdb->get_var( $wpdb->prepare(
				"SELECT source_slug FROM {$wpdb->prefix}hln_intake_log WHERE id = %d", (int) $log_id
			) );
			if ( $slug ) {
				return $slug;
			}
		}

		$calendar_id = HLN_Candidate_CPT::get_meta( $candidate_id, 'race_calendar_id' );
		if ( $calendar_id ) {
			return $wpdb->get_var( $wpdb->prepare(
				"SELECT source_slug FROM {$wpdb->prefix}hln_race_calendar WHERE id = %d", (int) $calendar_id
			) );
		}

		return null;
	}
}
