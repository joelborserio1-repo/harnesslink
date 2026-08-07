<?php
/**
 * HLN_Race_Data — governing-body race-data adapters + feature-race calendars.
 *
 * Spec §2.4 / §3.3: per-source adapters normalise fields/results into the
 * common Story Candidate shape (data_type: result | field | fixture).
 * Where a source has no feed/API — true of every source seeded in Phase 1,
 * since none has a confirmed API integration yet — a monitored-page
 * fetch + diff job substitutes, reusing HLN_Parsing_Utils the same way
 * the email PDF handling does.
 *
 * The feature-race-calendar adapter runs across every jurisdiction seeded
 * into HLN_Sources, not a single market. Per-body page markup isn't known
 * ahead of time, so calendar extraction uses a generic best-effort table
 * reader plus a per-source selector override map — the same shape as the
 * legacy plugin's per-source XPath arrays in AD_Sources — filterable via
 * 'hln_race_calendar_selectors' so real selectors can be added per body
 * once confirmed, without changing this class.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Race_Data {

	const REQUEST_TIMEOUT = 30;

	public function __construct() {
		add_filter( 'cron_schedules', [ $this, 'add_intervals' ] );
		add_action( 'init', [ $this, 'ensure_schedules' ] );
		add_action( 'update_option_hln_source_overrides', [ $this, 'reschedule_all' ] );

		foreach ( self::pollable_sources() as $key => $entry ) {
			add_action( 'hln_race_data_poll_' . $key, function () use ( $key ) {
				$this->run_source( $key );
			} );
		}

		add_action( 'hln_race_calendar_poll', [ $this, 'run_calendar_for_all_jurisdictions' ] );
	}

	/* =========================================================
	   SOURCE LIST
	========================================================= */

	private static function pollable_sources() {
		$out = [];
		foreach ( [ 'official', 'race-data' ] as $type ) {
			foreach ( HLN_Sources::get_by_type( $type ) as $slug => $entry ) {
				if ( empty( $entry['enabled'] ) ) {
					continue;
				}
				$out[ $type . ':' . $slug ] = array_merge( $entry, [ '_type' => $type, '_slug' => $slug ] );
			}
		}
		return $out;
	}

	/* =========================================================
	   SCHEDULING
	========================================================= */

	public function add_intervals( $schedules ) {
		foreach ( self::pollable_sources() as $entry ) {
			$schedules = HLN_Cron_Utils::register_interval( $schedules, $entry['check_frequency'] ?? '1h' );
		}
		return HLN_Cron_Utils::register_interval( $schedules, '30m' );
	}

	public function ensure_schedules() {
		foreach ( self::pollable_sources() as $key => $entry ) {
			$hook = 'hln_race_data_poll_' . $key;
			if ( ! wp_next_scheduled( $hook ) ) {
				wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( $entry['check_frequency'] ?? '1h' ), $hook );
			}
		}
		if ( ! wp_next_scheduled( 'hln_race_calendar_poll' ) ) {
			wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( '30m' ), 'hln_race_calendar_poll' );
		}
	}

	public function reschedule_all() {
		foreach ( self::pollable_sources() as $key => $entry ) {
			wp_clear_scheduled_hook( 'hln_race_data_poll_' . $key );
		}
		$this->ensure_schedules();
	}

	/* =========================================================
	   PER-SOURCE RESULT/FIELD/FIXTURE POLL
	========================================================= */

	public function run_source( $key ) {
		if ( false === strpos( $key, ':' ) ) {
			return;
		}
		[ $type, $slug ] = explode( ':', $key, 2 );
		$entry = HLN_Sources::get( $type, $slug );
		if ( empty( $entry ) || empty( $entry['enabled'] ) ) {
			return;
		}
		$entry['_type'] = $type;
		$entry['_slug'] = $slug;

		if ( 'api' === $entry['ingestion_method'] ) {
			$this->run_api_adapter( $entry );
			return;
		}

		$this->run_monitored_page( $entry );
	}

	/**
	 * Extensibility point for sources with a confirmed API integration.
	 * None of the sources seeded in Phase 1 have one yet — every seed
	 * entry uses 'monitored-page' — so this fires a filter that returns
	 * an empty array until a real adapter hooks in, rather than
	 * fabricating a response.
	 */
	private function run_api_adapter( array $entry ) {
		$items = apply_filters( 'hln_race_data_api_adapter_' . $entry['_slug'], [], $entry );
		foreach ( $items as $item ) {
			$this->log_race_data_item( $entry, $item );
		}
	}

	private function run_monitored_page( array $entry ) {
		if ( empty( $entry['url'] ) ) {
			return;
		}
		$response = $this->fetch( $entry['url'] );
		if ( is_wp_error( $response ) ) {
			return;
		}

		$body = wp_remote_retrieve_body( $response );
		$hash = md5( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $body ) ) );

		if ( $this->already_seen( $entry['_slug'], $hash ) ) {
			return;
		}
		$this->record_seen( $entry['_slug'], $hash );

		$text = HLN_Parsing_Utils::extract_short_excerpt( $body, 400 );
		if ( '' === trim( wp_strip_all_tags( $body ) ) ) {
			return;
		}

		if ( HLN_Parsing_Utils::looks_like_stewards_report( $body ) ) {
			$parsed = HLN_Stewards_Parser::parse( wp_strip_all_tags( $body ), $entry );
			HLN_Intake_Log::insert( [
				'channel'                   => 'race-data',
				'status'                    => $parsed['requires_source_clearance'] ? HLN_Intake_Log::STATUS_QUARANTINED : HLN_Intake_Log::STATUS_PROCESSED,
				'source_type'               => $entry['source_type'],
				'source_slug'               => $entry['_slug'],
				'source_name'               => $entry['label'],
				'source_credit'             => $entry['label'],
				'region'                    => $entry['region'],
				'governing_body'            => $entry['governing_body'],
				'trust_score'               => $entry['trust_score'] ?? null,
				'headline'                  => $parsed['headline'],
				'body_excerpt'              => $parsed['body_excerpt'],
				'original_url'              => $entry['url'],
				'entities'                  => array_merge( $parsed['entities'], [ 'stewards_tags' => $parsed['tags'] ] ),
				'data_type'                 => 'article',
				'requires_source_clearance' => $parsed['requires_source_clearance'] ? 1 : 0,
				'confirm_status'            => $parsed['confirm_status'],
			] );
			return;
		}

		HLN_Intake_Log::insert( [
			'channel'        => 'race-data',
			'status'         => HLN_Intake_Log::STATUS_PROCESSED,
			'source_type'    => $entry['source_type'],
			'source_slug'    => $entry['_slug'],
			'source_name'    => $entry['label'],
			'source_credit'  => $entry['label'],
			'region'         => $entry['region'],
			'governing_body' => $entry['governing_body'],
			'trust_score'    => $entry['trust_score'] ?? null,
			'headline'       => wp_trim_words( wp_strip_all_tags( $body ), 15, '…' ),
			'body_excerpt'   => $text,
			'original_url'   => $entry['url'],
			'entities'       => HLN_Parsing_Utils::extract_entities_naive( $body ),
			'data_type'      => HLN_Parsing_Utils::guess_data_type( $entry['url'], $body ),
		] );
	}

	private function log_race_data_item( array $entry, array $item ) {
		HLN_Intake_Log::insert( array_merge( [
			'channel'        => 'race-data',
			'status'         => HLN_Intake_Log::STATUS_PROCESSED,
			'source_type'    => $entry['source_type'],
			'source_slug'    => $entry['_slug'],
			'source_name'    => $entry['label'],
			'source_credit'  => $entry['label'],
			'region'         => $entry['region'],
			'governing_body' => $entry['governing_body'],
			'trust_score'    => $entry['trust_score'] ?? null,
			'data_type'      => 'result',
		], $item ) );
	}

	/* =========================================================
	   FEATURE-RACE CALENDAR (all jurisdictions)
	========================================================= */

	public function run_calendar_for_all_jurisdictions() {
		foreach ( HLN_Sources::get_by_type( 'official' ) as $slug => $entry ) {
			if ( empty( $entry['enabled'] ) || empty( $entry['url'] ) ) {
				continue;
			}
			$entry['_slug'] = $slug;
			$this->run_calendar_adapter( $entry );
		}
	}

	private function run_calendar_adapter( array $entry ) {
		$response = $this->fetch( $entry['url'] );
		if ( is_wp_error( $response ) ) {
			return;
		}
		$body = wp_remote_retrieve_body( $response );
		$rows = $this->extract_calendar_rows( $body, $entry );

		foreach ( $rows as $row ) {
			$this->upsert_calendar_entry( $entry, $row );
		}
	}

	/**
	 * Generic best-effort calendar-table reader: pulls rows from any
	 * <table> whose header cells mention race/date/grade/prize, plus any
	 * per-source override registered via 'hln_race_calendar_selectors'.
	 * Real per-body markup isn't known yet, so this intentionally
	 * degrades to an empty result rather than guessing at content.
	 *
	 * @return array[] Each row: ['race_name','race_date','grade','prize_money']
	 */
	private function extract_calendar_rows( $html, array $entry ) {
		$overrides = apply_filters( 'hln_race_calendar_selectors', [], $entry );
		if ( ! empty( $overrides ) && is_callable( $overrides ) ) {
			return (array) call_user_func( $overrides, $html, $entry );
		}

		if ( empty( $html ) ) {
			return [];
		}

		libxml_use_internal_errors( true );
		$doc = new DOMDocument();
		$doc->loadHTML( '<?xml encoding="UTF-8">' . $html );
		libxml_clear_errors();
		$xpath = new DOMXPath( $doc );

		$rows = [];
		foreach ( $xpath->query( '//table' ) as $table ) {
			$header_text = strtolower( trim( $table->textContent ) );
			if ( ! preg_match( '/race|date|grade|stake|prize/i', $header_text ) ) {
				continue;
			}
			foreach ( $xpath->query( './/tr', $table ) as $tr ) {
				$cells = [];
				foreach ( $xpath->query( './/td|.//th', $tr ) as $cell ) {
					$cells[] = trim( $cell->textContent );
				}
				if ( count( $cells ) < 2 ) {
					continue;
				}
				$rows[] = [
					'race_name'   => $cells[0] ?? '',
					'race_date'   => $this->find_date_in_cells( $cells ),
					'grade'       => $this->find_grade_in_cells( $cells ),
					'prize_money' => $this->find_prize_in_cells( $cells ),
				];
			}
		}

		return array_filter( $rows, fn( $r ) => '' !== $r['race_name'] );
	}

	private function find_date_in_cells( array $cells ) {
		foreach ( $cells as $cell ) {
			$ts = strtotime( $cell );
			if ( $ts && preg_match( '/\d{4}|\d{1,2}\/\d{1,2}/', $cell ) ) {
				return gmdate( 'Y-m-d', $ts );
			}
		}
		return null;
	}

	private function find_grade_in_cells( array $cells ) {
		foreach ( $cells as $cell ) {
			if ( preg_match( '/\b(grade|group|G[1-3])\b/i', $cell ) ) {
				return $cell;
			}
		}
		return '';
	}

	private function find_prize_in_cells( array $cells ) {
		foreach ( $cells as $cell ) {
			if ( preg_match( '/[$£€]\s?[\d,]+/', $cell, $m ) ) {
				return $m[0];
			}
		}
		return '';
	}

	private function upsert_calendar_entry( array $entry, array $row ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_calendar';

		$existing = $wpdb->get_row( $wpdb->prepare(
			"SELECT id FROM $table WHERE source_slug = %s AND race_name = %s AND (race_date = %s OR (race_date IS NULL AND %s IS NULL))",
			$entry['_slug'], $row['race_name'], $row['race_date'], $row['race_date']
		) );

		$fields = [
			'source_slug'    => $entry['_slug'],
			'governing_body' => $entry['governing_body'],
			'region'         => $entry['region'],
			'race_name'      => $row['race_name'],
			'race_date'      => $row['race_date'],
			'grade'          => $row['grade'],
			'prize_money'    => $row['prize_money'],
			'content_hash'   => md5( wp_json_encode( $row ) ),
			'updated_at'     => current_time( 'mysql' ),
		];

		if ( $existing ) {
			$wpdb->update( $table, $fields, [ 'id' => $existing->id ] );
		} else {
			$fields['created_at'] = current_time( 'mysql' );
			$wpdb->insert( $table, $fields );
		}
	}

	/* =========================================================
	   MONITORED-PAGE DIFF STATE
	========================================================= */

	private function already_seen( $slug, $hash ) {
		global $wpdb;
		$table   = $wpdb->prefix . 'hln_monitored_state';
		$current = $wpdb->get_var( $wpdb->prepare( "SELECT content_hash FROM $table WHERE source_slug = %s", $slug ) );
		return $current === $hash;
	}

	private function record_seen( $slug, $hash ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_monitored_state';
		$wpdb->replace( $table, [
			'source_slug'  => $slug,
			'content_hash' => $hash,
			'checked_at'   => current_time( 'mysql' ),
		] );
	}

	/* =========================================================
	   HTTP
	========================================================= */

	private function fetch( $url ) {
		$response = wp_remote_get( $url, [
			'timeout'    => self::REQUEST_TIMEOUT,
			'user-agent' => 'HarnessLinkNewsroom/' . HLN_VERSION . ' (+https://harnesslink.com)',
			'sslverify'  => true,
		] );

		if ( is_wp_error( $response ) ) {
			return $response;
		}
		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return new WP_Error( 'bad_response', 'Non-200 response from ' . $url );
		}
		return $response;
	}
}
