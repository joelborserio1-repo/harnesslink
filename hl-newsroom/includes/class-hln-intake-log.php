<?php
/**
 * HLN_Intake_Log — shared read/write access to the hln_intake_log table.
 *
 * Every intake channel (email in Phase 2; RSS + X in Phase 3) writes here
 * through insert(), so the admin log view and Phase 4's triage gate have
 * one consistent source of raw items regardless of which channel produced
 * them.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Intake_Log {

	const STATUS_PROCESSED   = 'processed';
	const STATUS_UNCLASSIFIED = 'unclassified';
	const STATUS_QUARANTINED = 'quarantined';

	private static function table() {
		global $wpdb;
		return $wpdb->prefix . 'hln_intake_log';
	}

	/**
	 * @param  array $fields
	 * @return int|false Inserted row ID, or false on failure.
	 */
	public static function insert( array $fields ) {
		global $wpdb;

		$defaults = [
			'channel'                   => '',
			'status'                    => self::STATUS_PROCESSED,
			'source_type'               => null,
			'source_slug'               => null,
			'source_name'               => null,
			'source_credit'             => null,
			'region'                    => null,
			'governing_body'            => null,
			'trust_score'               => null,
			'headline'                  => null,
			'body_excerpt'              => null,
			'original_url'              => null,
			'published_at'              => null,
			'ingested_at'               => current_time( 'mysql' ),
			'entities'                  => null,
			'data_type'                 => null,
			'images'                    => null,
			'video'                     => null,
			'requires_source_clearance' => 0,
			'verify_against_official'   => 0,
			'confirm_status'            => null,
			'reason'                    => null,
		];

		$row = array_merge( $defaults, $fields );

		foreach ( [ 'entities', 'images', 'video' ] as $json_field ) {
			if ( is_array( $row[ $json_field ] ) ) {
				$row[ $json_field ] = wp_json_encode( $row[ $json_field ] );
			}
		}

		$inserted = $wpdb->insert( self::table(), $row );
		return $inserted ? (int) $wpdb->insert_id : false;
	}

	/**
	 * @param  string $status
	 * @param  int    $limit
	 * @return object[]
	 */
	public static function get_by_status( $status, $limit = 100 ) {
		global $wpdb;
		$table = self::table();
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $table WHERE status = %s ORDER BY ingested_at DESC LIMIT %d",
			$status, $limit
		) );
	}

	/**
	 * @param  int   $limit
	 * @param  array $filters Optional: ['channel' => ..., 'status' => ...]
	 * @return object[]
	 */
	public static function get_recent( $limit = 100, array $filters = [] ) {
		global $wpdb;
		$table   = self::table();
		$where   = [ '1=1' ];
		$params  = [];

		if ( ! empty( $filters['channel'] ) ) {
			$where[]  = 'channel = %s';
			$params[] = $filters['channel'];
		}
		if ( ! empty( $filters['status'] ) ) {
			$where[]  = 'status = %s';
			$params[] = $filters['status'];
		}

		$sql = "SELECT * FROM $table WHERE " . implode( ' AND ', $where ) . ' ORDER BY ingested_at DESC LIMIT %d';
		$params[] = $limit;

		return $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
	}

	/**
	 * @return array [ status => count ]
	 */
	public static function counts_by_status() {
		global $wpdb;
		$table   = self::table();
		$results = $wpdb->get_results( "SELECT status, COUNT(*) AS total FROM $table GROUP BY status", ARRAY_A );

		$counts = [ self::STATUS_PROCESSED => 0, self::STATUS_UNCLASSIFIED => 0, self::STATUS_QUARANTINED => 0 ];
		foreach ( $results as $row ) {
			$counts[ $row['status'] ] = (int) $row['total'];
		}
		return $counts;
	}
}
