<?php
/**
 * HLN_Audit_Log — the read/write layer for hln_audit_log (Hard Requirement 5).
 *
 * Every meaningful editorial or system action is appended here, never
 * overwritten: candidate_created, candidate_updated, source_attached,
 * duplicate_check, tier_assigned, generation_requested,
 * generation_completed, generation_failed, qc_passed, qc_failed,
 * review_approved, review_rejected, published, manual_override,
 * ttl_archived, source_enabled, source_disabled, kill_switch_changed.
 *
 * candidate_id is nullable — system-level events (a source disabled, the
 * kill switch toggled) aren't about one candidate and are recorded with
 * source_slug instead. user_id is captured via get_current_user_id() at
 * write time (0/null for cron-triggered system events with no logged-in
 * user).
 *
 * HLN_Candidate_CPT::append_audit()/get_audit_trail() are thin wrappers
 * around this class, kept so existing call sites didn't need to change.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Audit_Log {

	private static function table() {
		global $wpdb;
		return $wpdb->prefix . 'hln_audit_log';
	}

	/**
	 * @param string   $event
	 * @param string   $detail
	 * @param int|null $candidate_id
	 * @param string|null $source_slug
	 */
	public static function log( $event, $detail = '', $candidate_id = null, $source_slug = null ) {
		global $wpdb;
		$wpdb->insert( self::table(), [
			'candidate_id' => $candidate_id ? (int) $candidate_id : null,
			'source_slug'  => $source_slug,
			'event'        => $event,
			'detail'       => $detail,
			'user_id'      => get_current_user_id() ?: null,
			'created_at'   => current_time( 'mysql' ),
		] );
	}

	/**
	 * @param  int $candidate_id
	 * @return object[] Ordered oldest first.
	 */
	public static function get_for_candidate( $candidate_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM " . self::table() . " WHERE candidate_id = %d ORDER BY created_at ASC", (int) $candidate_id
		) );
	}

	/**
	 * System-wide recent activity — candidate and system events alike.
	 * Used by the Audit Log admin screen.
	 *
	 * @param  int $limit
	 * @return object[]
	 */
	public static function get_recent( $limit = 100 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM " . self::table() . " ORDER BY created_at DESC LIMIT %d", $limit
		) );
	}
}
