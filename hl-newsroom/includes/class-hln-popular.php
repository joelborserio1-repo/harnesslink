<?php
/**
 * HLN_Popular — ranks PUBLISHED stories by a performance score
 * (spec §9/§11). Feeds /public/popular (Phase 7 item 2) and the Insider
 * newsletter (Phase 7 item 5).
 *
 * Real analytics integration is out of scope for this build. views_count,
 * engagement_score, and avg_time_on_page are placeholder postmeta fields
 * that default to 0 — the ranking logic below is real and ready, it just
 * has nothing but zeroes to rank against until a real analytics
 * integration starts writing to those fields.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Popular {

	/** Rough ceiling used only to normalise a raw score into a 0-1 range for HLN_Trending; arbitrary until real traffic data exists. */
	const NORMALISATION_CEILING = 1000;

	/**
	 * @param  int         $limit
	 * @param  string|null $region
	 * @return array[] [{post_id, title, url, score, views_count, engagement_score, avg_time_on_page}]
	 */
	public static function get_popular_posts( $limit = 10, $region = null ) {
		$args = [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'posts_per_page' => 200, // Score in PHP — WP can't ORDER BY a computed weighted sum of three meta keys.
			'meta_query'     => [ [ 'key' => '_hln_source_credit', 'compare' => 'EXISTS' ] ],
		];
		if ( $region ) {
			$args['meta_query'][] = [ 'key' => '_hln_region', 'value' => $region ];
		}

		$posts = get_posts( $args );
		$scored = [];
		foreach ( $posts as $post ) {
			$scored[] = array_merge( self::raw_metrics( $post->ID ), [
				'post_id' => $post->ID,
				'title'   => get_the_title( $post ),
				'url'     => get_permalink( $post ),
			] );
		}

		usort( $scored, fn( $a, $b ) => $b['score'] <=> $a['score'] );
		return array_slice( $scored, 0, $limit );
	}

	private static function raw_metrics( $post_id ) {
		$views      = (int) get_post_meta( $post_id, '_hln_views_count', true );
		$engagement = (int) get_post_meta( $post_id, '_hln_engagement_score', true );
		$avg_time   = (float) get_post_meta( $post_id, '_hln_avg_time_on_page', true );

		return [
			'views_count'      => $views,
			'engagement_score' => $engagement,
			'avg_time_on_page' => $avg_time,
			'score'            => $views + ( $engagement * 5 ) + ( $avg_time * 0.5 ),
		];
	}

	/**
	 * Used by HLN_Trending's historical-performance factor. Returns a
	 * value in [0, 1] — 0.5 (neutral) when there isn't enough data yet,
	 * which in practice is always true until real analytics flow in.
	 *
	 * @param  string $story_type
	 * @return float
	 */
	public static function average_score_for_story_type( $story_type ) {
		$posts = get_posts( [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'meta_query'     => [ [ 'key' => '_hln_story_type', 'value' => $story_type ] ],
		] );

		if ( empty( $posts ) ) {
			return 0.5;
		}

		$total = 0;
		foreach ( $posts as $post ) {
			$total += self::raw_metrics( $post->ID )['score'];
		}
		$average = $total / count( $posts );

		return min( 1, $average / self::NORMALISATION_CEILING );
	}
}
