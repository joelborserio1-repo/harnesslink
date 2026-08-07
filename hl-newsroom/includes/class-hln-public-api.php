<?php
/**
 * HLN_Public_API — public REST stubs (spec §7.3).
 *
 * TODO: no authentication or rate-limiting yet. Deferred per spec §19
 * until there's an actual partner integration to build it against —
 * this is a plain engineering TODO, not a promise of a date.
 *
 * Internal-only fields — trust_score, verify_against_official,
 * duplicate_of, requires_source_clearance — are stripped from every
 * response this class returns, unconditionally, via strip_internal_fields().
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Public_API {

	const INTERNAL_FIELDS = [ 'trust_score', 'verify_against_official', 'duplicate_of', 'requires_source_clearance' ];

	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route( 'hln/v1', '/public/stories', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'stories' ],
			'permission_callback' => '__return_true',
		] );
		register_rest_route( 'hln/v1', '/public/trending', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'trending' ],
			'permission_callback' => '__return_true',
		] );
		register_rest_route( 'hln/v1', '/public/feed.rss', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'feed_rss_redirect' ],
			'permission_callback' => '__return_true',
		] );
		register_rest_route( 'hln/v1', '/public/feed.json', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'feed_json' ],
			'permission_callback' => '__return_true',
		] );
		register_rest_route( 'hln/v1', '/public/popular', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'popular' ],
			'permission_callback' => '__return_true',
		] );
	}

	public function stories( WP_REST_Request $request ) {
		$posts = get_posts( [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'posts_per_page' => min( 50, absint( $request->get_param( 'limit' ) ) ?: 20 ),
			'meta_query'     => [ [ 'key' => '_hln_source_credit', 'compare' => 'EXISTS' ] ],
		] );

		$out = array_map( function ( $post ) {
			return self::strip_internal_fields( [
				'id'       => $post->ID,
				'title'    => get_the_title( $post ),
				'url'      => get_permalink( $post ),
				'excerpt'  => $post->post_excerpt,
				'date'     => get_the_date( 'c', $post ),
				'region'   => get_post_meta( $post->ID, '_hln_region', true ),
				'tier'     => get_post_meta( $post->ID, '_hln_tier', true ),
				'is_premium' => (bool) get_post_meta( $post->ID, '_hln_is_premium', true ),
			] );
		}, $posts );

		return new WP_REST_Response( $out, 200 );
	}

	public function trending( WP_REST_Request $request ) {
		$internal = new WP_REST_Request( 'GET', '/hln/v1/trending' );
		$internal->set_query_params( $request->get_query_params() );
		$response = rest_do_request( $internal );
		$data     = $response->get_data();

		return new WP_REST_Response( array_map( [ __CLASS__, 'strip_internal_fields' ], is_array( $data ) ? $data : [] ), 200 );
	}

	public function feed_rss_redirect() {
		wp_redirect( home_url( '/feed/hln-all/' ), 302 );
		exit;
	}

	public function feed_json( WP_REST_Request $request ) {
		$response = $this->stories( $request );
		$data     = $response->get_data();
		return new WP_REST_Response( [
			'version' => 'https://jsonfeed.org/version/1.1',
			'title'   => get_bloginfo( 'name' ) . ' — HarnessLink Newsroom',
			'items'   => array_map( function ( $s ) {
				return [
					'id'             => (string) $s['id'],
					'url'            => $s['url'],
					'title'          => $s['title'],
					'content_text'   => $s['excerpt'],
					'date_published' => $s['date'],
				];
			}, $data ),
		], 200 );
	}

	public function popular( WP_REST_Request $request ) {
		$region = $request->get_param( 'region' );
		$limit  = min( 50, absint( $request->get_param( 'limit' ) ) ?: 10 );
		$posts  = HLN_Popular::get_popular_posts( $limit, $region );

		return new WP_REST_Response( array_map( [ __CLASS__, 'strip_internal_fields' ], $posts ), 200 );
	}

	/**
	 * @param  array $data
	 * @return array
	 */
	public static function strip_internal_fields( array $data ) {
		foreach ( self::INTERNAL_FIELDS as $field ) {
			unset( $data[ $field ] );
		}
		return $data;
	}
}
