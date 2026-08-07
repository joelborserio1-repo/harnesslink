<?php
/**
 * HLN_RSS_Intake — one polling job per RSS feed in HLN_Sources (spec §3.2).
 *
 * Runs at each source's own check_frequency (official bodies configured
 * faster than trade press, per spec §2.1/§2.2). Every item is normalised
 * to headline/URL/publish time/excerpt/images/source and inherits the
 * source's trust_score. Anything from a trade-press source is flagged
 * verify_against_official — trade press is colour/quotes/angle only,
 * never unverified fact, per spec §2.2.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_RSS_Intake {

	/** First poll of a feed only looks at its most recent items, to avoid an initial backlog flood. */
	const MAX_ITEMS_ON_FIRST_POLL = 5;
	const MAX_ITEMS_PER_POLL      = 20;

	public function __construct() {
		add_filter( 'cron_schedules', [ $this, 'add_intervals' ] );
		add_action( 'init', [ $this, 'ensure_schedules' ] );
		add_action( 'update_option_hln_source_overrides', [ $this, 'reschedule_all' ] );

		foreach ( self::pollable_sources() as $key => $entry ) {
			add_action( 'hln_rss_poll_' . $key, function () use ( $key ) {
				$this->run_source( $key );
			} );
		}
	}

	private static function pollable_sources() {
		$out = [];
		foreach ( HLN_Sources::SOURCE_TYPES as $type ) {
			foreach ( HLN_Sources::get_by_type( $type ) as $slug => $entry ) {
				if ( empty( $entry['enabled'] ) || 'rss' !== ( $entry['ingestion_method'] ?? '' ) ) {
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
		return $schedules;
	}

	public function ensure_schedules() {
		foreach ( self::pollable_sources() as $key => $entry ) {
			$hook = 'hln_rss_poll_' . $key;
			if ( ! wp_next_scheduled( $hook ) ) {
				wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( $entry['check_frequency'] ?? '1h' ), $hook );
			}
		}
	}

	public function reschedule_all() {
		foreach ( self::pollable_sources() as $key => $entry ) {
			wp_clear_scheduled_hook( 'hln_rss_poll_' . $key );
		}
		$this->ensure_schedules();
	}

	/* =========================================================
	   POLL
	========================================================= */

	public function run_source( $key ) {
		if ( false === strpos( $key, ':' ) ) {
			return;
		}
		[ $type, $slug ] = explode( ':', $key, 2 );
		$entry = HLN_Sources::get( $type, $slug );
		if ( empty( $entry ) || empty( $entry['enabled'] ) || empty( $entry['url'] ) ) {
			return;
		}
		$entry['_type'] = $type;
		$entry['_slug'] = $slug;

		if ( ! function_exists( 'fetch_feed' ) ) {
			require_once ABSPATH . WPINC . '/feed.php';
		}

		$feed = fetch_feed( $entry['url'] );
		if ( is_wp_error( $feed ) ) {
			return;
		}

		$watermark_key = 'rss:' . $slug;
		$watermark     = $this->get_watermark( $watermark_key );

		// SimplePie returns items newest-first.
		$items = $feed->get_items( 0, self::MAX_ITEMS_PER_POLL );
		if ( ! $watermark ) {
			$items = array_slice( $items, 0, self::MAX_ITEMS_ON_FIRST_POLL );
		}

		$newest_seen = $watermark;

		foreach ( $items as $item ) {
			$published = $item->get_date( 'Y-m-d H:i:s' );
			if ( $watermark && $published && $published <= $watermark ) {
				continue;
			}
			if ( $published && ( ! $newest_seen || $published > $newest_seen ) ) {
				$newest_seen = $published;
			}
			$this->process_item( $item, $entry, $published );
		}

		if ( $newest_seen && $newest_seen !== $watermark ) {
			$this->record_watermark( $watermark_key, $newest_seen );
		}
	}

	private function process_item( $item, array $entry, $published ) {
		$title   = wp_strip_all_tags( (string) $item->get_title() );
		$url     = (string) $item->get_permalink();
		$content = (string) ( $item->get_content() ?: $item->get_description() );
		$excerpt = HLN_Parsing_Utils::extract_short_excerpt( $content );
		$combined_text = $title . ' ' . $content;

		if ( HLN_Parsing_Utils::looks_like_stewards_report( $title ) || HLN_Parsing_Utils::looks_like_stewards_report( $content ) ) {
			$parsed = HLN_Stewards_Parser::parse( wp_strip_all_tags( $combined_text ), $entry );
			HLN_Intake_Log::insert( [
				'channel'                   => 'rss',
				'status'                    => $parsed['requires_source_clearance'] ? HLN_Intake_Log::STATUS_QUARANTINED : HLN_Intake_Log::STATUS_PROCESSED,
				'source_type'               => $entry['source_type'],
				'source_slug'               => $entry['_slug'],
				'source_name'               => $entry['label'],
				'source_credit'             => $entry['label'],
				'region'                    => $entry['region'],
				'governing_body'            => $entry['governing_body'],
				'trust_score'               => $entry['trust_score'] ?? null,
				'headline'                  => $parsed['headline'] ?: wp_trim_words( $title, 20, '…' ),
				'body_excerpt'              => $parsed['body_excerpt'],
				'original_url'              => $url,
				'published_at'              => $published,
				'entities'                  => array_merge( $parsed['entities'], [ 'stewards_tags' => $parsed['tags'] ] ),
				'data_type'                 => 'article',
				'requires_source_clearance' => $parsed['requires_source_clearance'] ? 1 : 0,
				'confirm_status'            => $parsed['confirm_status'],
			] );
			return;
		}

		HLN_Intake_Log::insert( [
			'channel'                 => 'rss',
			'status'                  => HLN_Intake_Log::STATUS_PROCESSED,
			'source_type'             => $entry['source_type'],
			'source_slug'             => $entry['_slug'],
			'source_name'             => $entry['label'],
			'source_credit'           => $entry['label'],
			'region'                  => $entry['region'],
			'governing_body'          => $entry['governing_body'],
			'trust_score'             => $entry['trust_score'] ?? null,
			'headline'                => wp_trim_words( $title, 20, '…' ),
			'body_excerpt'            => $excerpt,
			'original_url'            => $url,
			'published_at'            => $published,
			'entities'                => HLN_Parsing_Utils::extract_entities_naive( $combined_text ),
			'data_type'               => HLN_Parsing_Utils::guess_data_type( $url, $combined_text ),
			'images'                  => $this->extract_images( $item ),
			'verify_against_official' => 'trade-press' === $entry['source_type'] ? 1 : 0,
		] );
	}

	private function extract_images( $item ) {
		$images = [];
		$enclosure = $item->get_enclosure();
		if ( $enclosure && $enclosure->get_link() ) {
			$images[] = HLN_Parsing_Utils::build_image_entry( $enclosure->get_link(), false );
		}
		return $images;
	}

	/* =========================================================
	   WATERMARK STATE (reuses hln_monitored_state)
	========================================================= */

	private function get_watermark( $key ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_monitored_state';
		return $wpdb->get_var( $wpdb->prepare( "SELECT content_hash FROM $table WHERE source_slug = %s", $key ) );
	}

	private function record_watermark( $key, $value ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_monitored_state';
		$wpdb->replace( $table, [
			'source_slug'  => $key,
			'content_hash' => $value,
			'checked_at'   => current_time( 'mysql' ),
		] );
	}
}
