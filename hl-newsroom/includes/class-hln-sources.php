<?php
/**
 * HLN_Sources — Registry of newsroom intake sources.
 *
 * Grouped by source_type per spec §2:
 *   official         – governing-body sites/feeds (spec §2.1)
 *   trade-press      – trade publications, hard-gated (spec §2.2)
 *   verified-social  – X allow-list sub-registry, seeded empty until Phase 3 (spec §2.3)
 *   race-data        – per-body race feeds/calendars, seeded empty until Phase 2 (spec §2.4)
 *
 * Each entry in the official/trade-press groups carries:
 *   label             – human-readable name shown in the UI
 *   region            – usa | canada | australia | new_zealand | europe
 *   source_type       – official | trade-press | verified-social | race-data
 *   url               – source URL
 *   ingestion_method  – api | rss | email | monitored-page | x-api
 *   trust_score       – 0-100, starting weight for triage/trending
 *   check_frequency   – cron-style interval, e.g. "30m", "1h", "6h"
 *   auto_publish      – per-source boolean, always defaults to false (Hard Requirement 5)
 *   governing_body    – set for official/race-data rows, null otherwise
 *   enabled           – admin can disable a source without removing it
 *
 * If none of the exact bodies/outlets seeded below match what HarnessLink
 * editorial actually wants monitored, use the Sources admin screen to edit
 * or disable entries rather than editing this file — admin edits are stored
 * as overrides and always take precedence over the seed list.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Sources {

	const REGIONS = [ 'usa', 'canada', 'australia', 'new_zealand', 'europe' ];

	const SOURCE_TYPES = [ 'official', 'trade-press', 'verified-social', 'race-data' ];

	/**
	 * Return the full source registry, grouped by source_type, with any
	 * admin-saved overrides applied on top.
	 *
	 * Plugins/themes can filter 'hln_sources' to add or adjust entries
	 * before overrides are applied.
	 *
	 * @return array[]
	 */
	public static function get_all() {
		$sources = [

			'official' => [

				/* ---------------- United States ---------------- */
				'usta' => [
					'label'            => 'United States Trotting Association (USTA)',
					'region'           => 'usa',
					'source_type'      => 'official',
					'url'              => 'https://www.ustrotting.com',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 95,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'United States Trotting Association',
					'enabled'          => true,
				],

				/* ---------------- Canada ---------------- */
				'standardbred_canada' => [
					'label'            => 'Standardbred Canada',
					'region'           => 'canada',
					'source_type'      => 'official',
					'url'              => 'https://standardbredcanada.ca',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 95,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Standardbred Canada',
					'enabled'          => true,
				],

				/* ---------------- Australia (national + state bodies) ---------------- */
				'harness_racing_australia' => [
					'label'            => 'Harness Racing Australia',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://harness.org.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Harness Racing Australia',
					'enabled'          => true,
				],
				'hrnsw' => [
					'label'            => 'Harness Racing New South Wales',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://www.hrnsw.com.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Harness Racing New South Wales',
					'enabled'          => true,
				],
				'hrv' => [
					'label'            => 'Harness Racing Victoria',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://www.hrv.org.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Harness Racing Victoria',
					'enabled'          => true,
				],
				'qld_harness' => [
					'label'            => 'Queensland Harness Racing Board',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://www.qldharness.org.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Queensland Harness Racing Board',
					'enabled'          => true,
				],
				'hrsa' => [
					'label'            => 'Harness Racing South Australia',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://www.hrsa.asn.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Harness Racing South Australia',
					'enabled'          => true,
				],
				'rwwa_harness' => [
					'label'            => 'Racing and Wagering Western Australia — Harness',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://www.rwwa.com.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Racing and Wagering Western Australia',
					'enabled'          => true,
				],
				'tasracing_harness' => [
					'label'            => 'Tasracing — Harness',
					'region'           => 'australia',
					'source_type'      => 'official',
					'url'              => 'https://www.tasracing.com.au',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Tasracing',
					'enabled'          => true,
				],

				/* ---------------- New Zealand ---------------- */
				'hrnz' => [
					'label'            => 'Harness Racing New Zealand (HRNZ)',
					'region'           => 'new_zealand',
					'source_type'      => 'official',
					'url'              => 'https://www.hrnz.co.nz',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 95,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Harness Racing New Zealand',
					'enabled'          => true,
				],

				/* ---------------- Europe (incl. UK/IRE) ---------------- */
				'uet' => [
					'label'            => 'Union Européenne du Trot (UET)',
					'region'           => 'europe',
					'source_type'      => 'official',
					'url'              => 'https://uet-trot.eu',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '1h',
					'auto_publish'     => false,
					'governing_body'   => 'Union Européenne du Trot',
					'enabled'          => true,
				],
				'letrot' => [
					'label'            => 'Le Trot (France)',
					'region'           => 'europe',
					'source_type'      => 'official',
					'url'              => 'https://www.letrot.com',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Le Trot',
					'enabled'          => true,
				],
				'svensk_travsport' => [
					'label'            => 'Svensk Travsport (Sweden)',
					'region'           => 'europe',
					'source_type'      => 'official',
					'url'              => 'https://www.travsport.se',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 90,
					'check_frequency'  => '30m',
					'auto_publish'     => false,
					'governing_body'   => 'Svensk Travsport',
					'enabled'          => true,
				],
				'bhrc' => [
					'label'            => 'British Harness Racing Club',
					'region'           => 'europe',
					'source_type'      => 'official',
					'url'              => 'https://www.bhrc.co.uk',
					'ingestion_method' => 'monitored-page',
					'trust_score'      => 80,
					'check_frequency'  => '1h',
					'auto_publish'     => false,
					'governing_body'   => 'British Harness Racing Club',
					'enabled'          => true,
				],
			],

			'trade-press' => [

				'harness_racing_update' => [
					'label'            => 'Harness Racing Update (HRU)',
					'region'           => 'usa',
					'source_type'      => 'trade-press',
					'url'              => 'https://harnessracingupdate.com',
					'ingestion_method' => 'rss',
					'trust_score'      => 60,
					'check_frequency'  => '2h',
					'auto_publish'     => false,
					'governing_body'   => null,
					'enabled'          => true,
				],
				'hoof_beats' => [
					'label'            => 'Hoof Beats (USTA magazine)',
					'region'           => 'usa',
					'source_type'      => 'trade-press',
					'url'              => 'https://hoofbeats.ustrotting.com',
					'ingestion_method' => 'rss',
					'trust_score'      => 60,
					'check_frequency'  => '6h',
					'auto_publish'     => false,
					'governing_body'   => null,
					'enabled'          => true,
				],
				'trots_vision_news' => [
					'label'            => 'Trots Vision News',
					'region'           => 'australia',
					'source_type'      => 'trade-press',
					'url'              => 'https://www.trotsvision.com.au',
					'ingestion_method' => 'rss',
					'trust_score'      => 55,
					'check_frequency'  => '2h',
					'auto_publish'     => false,
					'governing_body'   => null,
					'enabled'          => true,
				],
				'nz_trade_press' => [
					'label'            => 'New Zealand harness racing trade press',
					'region'           => 'new_zealand',
					'source_type'      => 'trade-press',
					'url'              => '',
					'ingestion_method' => 'rss',
					'trust_score'      => 55,
					'check_frequency'  => '2h',
					'auto_publish'     => false,
					'governing_body'   => null,
					'enabled'          => true,
				],
				'europe_trade_press' => [
					'label'            => 'European harness racing trade press (regional outlets)',
					'region'           => 'europe',
					'source_type'      => 'trade-press',
					'url'              => '',
					'ingestion_method' => 'rss',
					'trust_score'      => 50,
					'check_frequency'  => '4h',
					'auto_publish'     => false,
					'governing_body'   => null,
					'enabled'          => true,
				],
			],

			/*
			 * Populated in Phase 3 (spec §2.3). The X allow-list is a
			 * sub-registry with its own schema (handle, owning_entity,
			 * verification_method, date_added, region) — narrower and
			 * different in shape from the official/trade-press schema
			 * above, so it is left empty here rather than seeded with
			 * placeholder rows.
			 */
			'verified-social' => [],

			/*
			 * Populated in Phase 2 (spec §2.4): per-body race feeds/APIs,
			 * monitored-page fallbacks, and feature-race calendars.
			 */
			'race-data' => [],
		];

		/**
		 * Filter: hln_sources
		 * Allows other code to register additional sources or adjust the
		 * seed list before admin overrides are applied.
		 *
		 * @param array $sources Grouped by source_type.
		 */
		$sources = apply_filters( 'hln_sources', $sources );

		return self::apply_overrides( $sources );
	}

	/**
	 * Merge admin-saved overrides (edits, disables, and admin-added
	 * sources) on top of the seed + filtered registry.
	 *
	 * @param  array $sources
	 * @return array
	 */
	protected static function apply_overrides( $sources ) {
		$overrides = get_option( 'hln_source_overrides', [] );
		if ( empty( $overrides ) || ! is_array( $overrides ) ) {
			return $sources;
		}

		foreach ( $overrides as $type => $slugs ) {
			if ( ! in_array( $type, self::SOURCE_TYPES, true ) || ! is_array( $slugs ) ) {
				continue;
			}
			foreach ( $slugs as $slug => $fields ) {
				if ( ! is_array( $fields ) ) {
					continue;
				}
				if ( isset( $sources[ $type ][ $slug ] ) ) {
					$sources[ $type ][ $slug ] = array_merge( $sources[ $type ][ $slug ], $fields );
				} else {
					$sources[ $type ][ $slug ] = array_merge( self::empty_entry( $type ), $fields );
				}
			}
		}

		return $sources;
	}

	/**
	 * Default field set for a brand-new, admin-added source.
	 *
	 * @param  string $type
	 * @return array
	 */
	protected static function empty_entry( $type ) {
		return [
			'label'            => '',
			'region'           => '',
			'source_type'      => $type,
			'url'              => '',
			'ingestion_method' => 'monitored-page',
			'trust_score'      => 50,
			'check_frequency'  => '1h',
			'auto_publish'     => false,
			'governing_body'   => null,
			'enabled'          => true,
		];
	}

	/**
	 * Save (add or edit) a single source as an admin override.
	 *
	 * @param string $type
	 * @param string $slug
	 * @param array  $fields
	 */
	public static function save_override( $type, $slug, array $fields ) {
		$overrides = get_option( 'hln_source_overrides', [] );
		if ( ! is_array( $overrides ) ) {
			$overrides = [];
		}
		if ( ! isset( $overrides[ $type ] ) || ! is_array( $overrides[ $type ] ) ) {
			$overrides[ $type ] = [];
		}
		$overrides[ $type ][ $slug ] = array_merge( $overrides[ $type ][ $slug ] ?? [], $fields );
		update_option( 'hln_source_overrides', $overrides );
	}

	/**
	 * Enable or disable a source without removing it from the registry.
	 *
	 * @param string $type
	 * @param string $slug
	 * @param bool   $enabled
	 */
	public static function set_enabled( $type, $slug, $enabled ) {
		self::save_override( $type, $slug, [ 'enabled' => (bool) $enabled ] );
	}

	/**
	 * Get a single source entry by type + slug.
	 *
	 * @param  string $type
	 * @param  string $slug
	 * @return array|null
	 */
	public static function get( $type, $slug ) {
		$all = self::get_all();
		return $all[ $type ][ $slug ] ?? null;
	}

	/**
	 * Get every entry of a given source_type.
	 *
	 * @param  string $type
	 * @return array[]
	 */
	public static function get_by_type( $type ) {
		$all = self::get_all();
		return $all[ $type ] ?? [];
	}

	/**
	 * Flatten the grouped registry into a single [slug => entry] array
	 * for admin list-table display. Each entry keeps its own
	 * 'source_type' field, and the flattening key is prefixed with the
	 * type to guarantee uniqueness across groups.
	 *
	 * @return array[]
	 */
	public static function all_flat() {
		$flat = [];
		foreach ( self::get_all() as $type => $entries ) {
			foreach ( $entries as $slug => $entry ) {
				$flat[ $type . ':' . $slug ] = array_merge( $entry, [
					'_type' => $type,
					'_slug' => $slug,
				] );
			}
		}
		return $flat;
	}

	/**
	 * Return [key => label] pairs — used for <select> dropdowns.
	 *
	 * @return string[]
	 */
	public static function dropdown_options() {
		$options = [];
		foreach ( self::all_flat() as $key => $entry ) {
			$options[ $key ] = $entry['label'];
		}
		return $options;
	}
}
