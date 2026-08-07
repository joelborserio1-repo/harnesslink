<?php
/**
 * HLN_DB — schema installer for the newsroom intake tables.
 *
 *   hln_intake_log        – every raw item from any intake channel (email
 *                            and race-data from Phase 2; RSS and X added in
 *                            Phase 3), with its processed/unclassified/
 *                            quarantined status. All channels share this
 *                            one table rather than each having its own.
 *   hln_race_calendar     – feature-race-calendar entries per jurisdiction.
 *   hln_race_intelligence – assembled racing-intelligence records, one per
 *                            calendar entry.
 *   hln_monitored_state   – last-seen watermark (content hash, or for
 *                            RSS/X a last-seen item id) per polled source,
 *                            so a poll only surfaces genuinely new content.
 *   hln_trending_signal   – Phase 3: output of the broad X trending scan
 *                            (spec §15). Deliberately its own table, never
 *                            hln_intake_log — HLN_Trending_Signal has no
 *                            way to reach a candidate's headline/excerpt/
 *                            entities even by mistake, because those
 *                            columns live in a different table it never
 *                            touches (Hard Requirement 9).
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_DB {

	const SCHEMA_VERSION = '1.1.0';

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();

		$intake_log = $wpdb->prefix . 'hln_intake_log';
		$calendar   = $wpdb->prefix . 'hln_race_calendar';
		$intel      = $wpdb->prefix . 'hln_race_intelligence';
		$monitored  = $wpdb->prefix . 'hln_monitored_state';

		dbDelta( "CREATE TABLE $intake_log (
			id                         BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			channel                    VARCHAR(20)  NOT NULL,
			status                     VARCHAR(20)  NOT NULL DEFAULT 'processed',
			source_type                VARCHAR(20)  DEFAULT NULL,
			source_slug                VARCHAR(100) DEFAULT NULL,
			source_name                VARCHAR(255) DEFAULT NULL,
			source_credit              VARCHAR(255) DEFAULT NULL,
			region                     VARCHAR(20)  DEFAULT NULL,
			governing_body             VARCHAR(255) DEFAULT NULL,
			trust_score                INT          DEFAULT NULL,
			headline                   TEXT         DEFAULT NULL,
			body_excerpt               TEXT         DEFAULT NULL,
			original_url               TEXT         DEFAULT NULL,
			published_at               DATETIME     DEFAULT NULL,
			ingested_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
			entities                   LONGTEXT     DEFAULT NULL,
			data_type                  VARCHAR(20)  DEFAULT NULL,
			images                     LONGTEXT     DEFAULT NULL,
			video                      LONGTEXT     DEFAULT NULL,
			requires_source_clearance  TINYINT(1)   NOT NULL DEFAULT 0,
			verify_against_official    TINYINT(1)   NOT NULL DEFAULT 0,
			confirm_status             VARCHAR(30)  DEFAULT NULL,
			reason                     TEXT         DEFAULT NULL,
			PRIMARY KEY  (id),
			KEY status (status),
			KEY channel (channel)
		) $charset;" );

		dbDelta( "CREATE TABLE $calendar (
			id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			source_slug     VARCHAR(100) NOT NULL,
			governing_body  VARCHAR(255) DEFAULT NULL,
			region          VARCHAR(20)  DEFAULT NULL,
			race_name       VARCHAR(255) NOT NULL,
			race_date       DATE         DEFAULT NULL,
			grade           VARCHAR(100) DEFAULT NULL,
			prize_money     VARCHAR(100) DEFAULT NULL,
			content_hash    VARCHAR(64)  DEFAULT NULL,
			created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at      DATETIME     DEFAULT NULL,
			PRIMARY KEY  (id),
			KEY source_slug (source_slug),
			KEY race_date (race_date)
		) $charset;" );

		dbDelta( "CREATE TABLE $intel (
			id                 BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			calendar_entry_id  BIGINT(20) UNSIGNED NOT NULL,
			payload            LONGTEXT     DEFAULT NULL,
			assembled_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY calendar_entry_id (calendar_entry_id)
		) $charset;" );

		dbDelta( "CREATE TABLE $monitored (
			source_slug   VARCHAR(100) NOT NULL,
			content_hash  VARCHAR(64)  DEFAULT NULL,
			checked_at    DATETIME     DEFAULT NULL,
			PRIMARY KEY  (source_slug)
		) $charset;" );

		$trending = $wpdb->prefix . 'hln_trending_signal';
		dbDelta( "CREATE TABLE $trending (
			id             BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			term           VARCHAR(255) NOT NULL,
			region         VARCHAR(20)  DEFAULT NULL,
			sample_count   INT          NOT NULL DEFAULT 0,
			signal_score   FLOAT        NOT NULL DEFAULT 0,
			window_start   DATETIME     DEFAULT NULL,
			window_end     DATETIME     DEFAULT NULL,
			detected_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY term (term(191)),
			KEY detected_at (detected_at)
		) $charset;" );

		update_option( 'hln_db_version', self::SCHEMA_VERSION );
	}

	public static function maybe_upgrade() {
		if ( get_option( 'hln_db_version' ) === self::SCHEMA_VERSION ) {
			return;
		}
		self::install();
	}
}
