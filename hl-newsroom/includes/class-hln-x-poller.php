<?php
/**
 * HLN_X_Poller — polls the explicit verified-social (X) allow-list only
 * (spec §2.3/§3.4). No keyword or hashtag search happens in this class —
 * that is HLN_Trending_Signal's separate, broader job.
 *
 * Every candidate this class produces is unconditionally flagged
 * verify_against_official (Hard Requirement 10) — trust or trending
 * score never overrides that. The original post's wording is never
 * reproduced as a quote or excerpt: body_excerpt here is built from
 * detected entities and a link, not from the post's own text, so
 * "link + paraphrase, not reproduction" holds structurally rather than
 * by convention.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_X_Poller {

	const MAX_TWEETS_ON_FIRST_POLL = 3;
	const MAX_TWEETS_PER_POLL      = 10;
	const REQUEST_TIMEOUT          = 20;

	public function __construct() {
		add_filter( 'cron_schedules', [ $this, 'add_intervals' ] );
		add_action( 'init', [ $this, 'ensure_schedules' ] );
		add_action( 'update_option_hln_verified_social_accounts', [ $this, 'reschedule_all' ] );

		foreach ( self::enabled_accounts() as $handle => $account ) {
			add_action( 'hln_x_poll_' . $handle, function () use ( $handle ) {
				$this->run_handle( $handle );
			} );
		}
	}

	private static function enabled_accounts() {
		return array_filter( HLN_Sources::get_verified_social_accounts(), fn( $a ) => ! empty( $a['enabled'] ) );
	}

	/* =========================================================
	   SCHEDULING
	========================================================= */

	public function add_intervals( $schedules ) {
		foreach ( self::enabled_accounts() as $account ) {
			$schedules = HLN_Cron_Utils::register_interval( $schedules, $account['check_frequency'] ?? '15m' );
		}
		return $schedules;
	}

	public function ensure_schedules() {
		foreach ( self::enabled_accounts() as $handle => $account ) {
			$hook = 'hln_x_poll_' . $handle;
			if ( ! wp_next_scheduled( $hook ) ) {
				wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( $account['check_frequency'] ?? '15m' ), $hook );
			}
		}
	}

	public function reschedule_all() {
		foreach ( self::enabled_accounts() as $handle => $account ) {
			wp_clear_scheduled_hook( 'hln_x_poll_' . $handle );
		}
		$this->ensure_schedules();
	}

	/* =========================================================
	   POLL
	========================================================= */

	public function run_handle( $handle ) {
		$account = HLN_Sources::get_verified_social_account( $handle );
		if ( empty( $account ) || empty( $account['enabled'] ) ) {
			return;
		}

		$token = get_option( 'hln_x_api_bearer_token', '' );
		if ( '' === $token ) {
			return; // Not configured — do nothing rather than guess.
		}

		$user_id = $this->resolve_user_id( $handle, $token );
		if ( ! $user_id ) {
			return;
		}

		$tweets = $this->fetch_recent_tweets( $user_id, $token );
		if ( empty( $tweets ) ) {
			return;
		}

		$watermark_key = 'x:' . $handle;
		$watermark     = $this->get_watermark( $watermark_key );

		if ( ! $watermark ) {
			$tweets = array_slice( $tweets, 0, self::MAX_TWEETS_ON_FIRST_POLL );
		}

		$newest_seen = $watermark;
		foreach ( $tweets as $tweet ) {
			if ( $watermark && ! $this->id_is_newer( $tweet['id'], $watermark ) ) {
				continue;
			}
			if ( ! $newest_seen || $this->id_is_newer( $tweet['id'], $newest_seen ) ) {
				$newest_seen = $tweet['id'];
			}
			$this->process_tweet( $tweet, $handle, $account );
		}

		if ( $newest_seen && $newest_seen !== $watermark ) {
			$this->record_watermark( $watermark_key, $newest_seen );
		}
	}

	private function process_tweet( array $tweet, $handle, array $account ) {
		$entities      = HLN_Parsing_Utils::extract_entities_naive( $tweet['text'] );
		$topic_phrase  = ! empty( $entities ) ? implode( ', ', array_slice( $entities, 0, 3 ) ) : 'harness racing';
		$owning_entity = $account['owning_entity'] ?: $handle;

		$images = [];
		foreach ( $tweet['media_urls'] as $media_url ) {
			$images[] = HLN_Parsing_Utils::build_image_entry( $media_url, true ); // agency_flagged: not automatically clear to use.
		}

		HLN_Intake_Log::insert( [
			'channel'                  => 'x',
			'status'                   => HLN_Intake_Log::STATUS_PROCESSED,
			'source_type'              => 'verified-social',
			'source_slug'              => $handle,
			'source_name'              => $owning_entity . ' (@' . $handle . ')',
			'source_credit'            => $owning_entity,
			'region'                   => $account['region'] ?: null,
			'headline'                 => sprintf( '%s posts update on X regarding %s', $owning_entity, $topic_phrase ),
			'body_excerpt'             => sprintf( 'Update from %s on X — see the original post for full details.', $owning_entity ),
			'original_url'             => sprintf( 'https://x.com/%s/status/%s', $handle, $tweet['id'] ),
			'published_at'             => $tweet['created_at'],
			'entities'                 => $entities,
			'data_type'                => 'article',
			'images'                   => $images,
			'verify_against_official'  => 1, // Unconditional — Hard Requirement 10.
		] );
	}

	/* =========================================================
	   X API v2
	========================================================= */

	private function resolve_user_id( $handle, $token ) {
		$cache = get_option( 'hln_x_user_id_cache', [] );
		if ( isset( $cache[ $handle ] ) ) {
			return $cache[ $handle ];
		}

		$response = wp_remote_get( 'https://api.x.com/2/users/by/username/' . rawurlencode( $handle ), [
			'timeout' => self::REQUEST_TIMEOUT,
			'headers' => [ 'Authorization' => 'Bearer ' . $token ],
		] );

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		$id   = $body['data']['id'] ?? null;
		if ( ! $id ) {
			return null;
		}

		$cache[ $handle ] = $id;
		update_option( 'hln_x_user_id_cache', $cache );
		return $id;
	}

	/**
	 * @return array[] Each: ['id','text','created_at','media_urls'=>[]]
	 */
	private function fetch_recent_tweets( $user_id, $token ) {
		$url = add_query_arg( [
			'max_results'  => self::MAX_TWEETS_PER_POLL,
			'tweet.fields' => 'created_at,attachments',
			'expansions'   => 'attachments.media_keys',
			'media.fields' => 'url',
		], 'https://api.x.com/2/users/' . rawurlencode( $user_id ) . '/tweets' );

		$response = wp_remote_get( $url, [
			'timeout' => self::REQUEST_TIMEOUT,
			'headers' => [ 'Authorization' => 'Bearer ' . $token ],
		] );

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return [];
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		$media_by_key = [];
		foreach ( $body['includes']['media'] ?? [] as $media ) {
			if ( ! empty( $media['media_key'] ) && ! empty( $media['url'] ) ) {
				$media_by_key[ $media['media_key'] ] = $media['url'];
			}
		}

		$tweets = [];
		foreach ( $body['data'] ?? [] as $tweet ) {
			$media_urls = [];
			foreach ( $tweet['attachments']['media_keys'] ?? [] as $key ) {
				if ( isset( $media_by_key[ $key ] ) ) {
					$media_urls[] = $media_by_key[ $key ];
				}
			}
			$tweets[] = [
				'id'         => (string) $tweet['id'],
				'text'       => (string) ( $tweet['text'] ?? '' ),
				'created_at' => ! empty( $tweet['created_at'] ) ? gmdate( 'Y-m-d H:i:s', strtotime( $tweet['created_at'] ) ) : null,
				'media_urls' => $media_urls,
			];
		}
		return $tweets;
	}

	/* =========================================================
	   ID COMPARISON (X snowflake IDs — big integers as strings)
	========================================================= */

	private function id_is_newer( $candidate, $watermark ) {
		$candidate = (string) $candidate;
		$watermark = (string) $watermark;
		if ( strlen( $candidate ) !== strlen( $watermark ) ) {
			return strlen( $candidate ) > strlen( $watermark );
		}
		return $candidate > $watermark;
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
