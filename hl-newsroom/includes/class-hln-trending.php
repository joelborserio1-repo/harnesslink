<?php
/**
 * HLN_Trending — trending score computation for the Trending Story Feed
 * (spec §5).
 *
 * Combines: source trust, recency (breaking decays fastest), cross-source
 * corroboration (the same story across multiple source_types raises the
 * score), entity significance (cross-referenced against the archive),
 * historical performance of similar story types/sources (Phase 7's Popular
 * dataset once it exists — still placeholder-valued until real analytics
 * flow in, exactly as spec §5.1 describes), and duplicate demotion.
 *
 * Also completes the wiring Phase 3 deliberately left as a placeholder:
 * HLN_Trending_Signal writes raw X-scan volume to its own hln_trending_signal
 * table; this class is what reads that table and folds it into a
 * candidate's _hln_trending_signal meta, matched by entity.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Trending {

	const BATCH_SIZE = 50;

	public function __construct() {
		add_action( 'init', [ $this, 'ensure_schedule' ] );
		add_action( 'hln_trending_run', [ $this, 'run' ] );
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	public function ensure_schedule() {
		if ( ! wp_next_scheduled( 'hln_trending_run' ) ) {
			wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( '10m' ), 'hln_trending_run' );
		}
	}

	public function run() {
		$candidates = get_posts( [
			'post_type'      => HLN_Candidate_CPT::POST_TYPE,
			'post_status'    => [ 'hln_new' ],
			'posts_per_page' => self::BATCH_SIZE,
		] );

		foreach ( $candidates as $candidate ) {
			$this->compute( $candidate->ID );
		}
	}

	/**
	 * @param  int $candidate_id
	 * @return float
	 */
	public function compute( $candidate_id ) {
		$trust_score  = (float) HLN_Candidate_CPT::get_meta( $candidate_id, 'trust_score', 50 );
		$entities     = HLN_Candidate_CPT::get_meta( $candidate_id, 'entities', [] );
		$source_type  = HLN_Candidate_CPT::get_meta( $candidate_id, 'source_type', '' );
		$published_at = HLN_Candidate_CPT::get_meta( $candidate_id, 'published_at' );
		$duplicate_of = HLN_Candidate_CPT::get_meta( $candidate_id, 'duplicate_of' );

		$recency_factor       = $this->recency_factor( $published_at );
		$corroboration        = $this->corroboration_factor( $entities, $source_type, $candidate_id );
		$entity_significance  = $this->entity_significance_factor( $entities );
		$historical_factor    = $this->historical_performance_factor( HLN_Candidate_CPT::get_meta( $candidate_id, 'story_type' ) );
		$x_signal             = $this->x_signal_factor( $entities );

		$score = ( $trust_score / 100 ) * 40
			+ $recency_factor * 25
			+ $corroboration * 15
			+ $entity_significance * 10
			+ $historical_factor * 5
			+ $x_signal * 5;

		if ( $duplicate_of ) {
			$score *= 0.3; // Demoted, never hidden.
		}

		$score = round( $score, 1 );

		HLN_Candidate_CPT::set_meta( $candidate_id, [
			'trending_signal' => $score,
			'tier'            => $this->assign_tier( $candidate_id, $score ),
		] );

		return $score;
	}

	private function recency_factor( $published_at ) {
		if ( empty( $published_at ) ) {
			return 0.5;
		}
		$hours = ( time() - strtotime( $published_at ) ) / HOUR_IN_SECONDS;
		if ( $hours < 0 ) {
			$hours = 0;
		}
		// Breaking decays fastest: full weight in the first hour, half by 12h, near zero by 48h.
		return max( 0, 1 - ( $hours / 48 ) );
	}

	private function corroboration_factor( array $entities, $source_type, $candidate_id ) {
		if ( empty( $entities ) ) {
			return 0;
		}
		global $wpdb;
		$like_terms = array_slice( $entities, 0, 3 );
		$table      = $wpdb->prefix . 'hln_intake_log';

		$distinct_types = 0;
		foreach ( $like_terms as $term ) {
			$types = $wpdb->get_col( $wpdb->prepare(
				"SELECT DISTINCT source_type FROM $table WHERE entities LIKE %s AND source_type != %s",
				'%' . $wpdb->esc_like( $term ) . '%', $source_type
			) );
			$distinct_types = max( $distinct_types, count( $types ) );
		}

		return min( 1, $distinct_types / 3 );
	}

	private function entity_significance_factor( array $entities ) {
		if ( empty( $entities ) ) {
			return 0;
		}
		$query = new WP_Query( [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			's'              => implode( ' ', array_slice( $entities, 0, 3 ) ),
			'posts_per_page' => 1,
			'no_found_rows'  => false,
		] );
		return min( 1, $query->found_posts / 10 );
	}

	/**
	 * Placeholder dataset per spec §5.1 until real analytics exist —
	 * folds in Phase 7's Popular scores once that class is loaded, which
	 * are themselves placeholder-valued (views_count etc. default to 0)
	 * until a real analytics integration is wired up.
	 */
	private function historical_performance_factor( $story_type ) {
		if ( ! class_exists( 'HLN_Popular' ) || empty( $story_type ) ) {
			return 0.5;
		}
		return HLN_Popular::average_score_for_story_type( $story_type );
	}

	private function x_signal_factor( array $entities ) {
		if ( empty( $entities ) ) {
			return 0;
		}
		global $wpdb;
		$table = $wpdb->prefix . 'hln_trending_signal';
		$max   = 0;
		foreach ( array_slice( $entities, 0, 3 ) as $entity ) {
			$score = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT MAX(signal_score) FROM $table WHERE term = %s AND detected_at >= %s",
				$entity, gmdate( 'Y-m-d H:i:s', strtotime( '-6 hours' ) )
			) );
			$max = max( $max, $score );
		}
		return min( 1, $max / 50 ); // Raw tweet-count volume, normalised against a modest reference ceiling.
	}

	/**
	 * Tier per spec §11 — news urgency, not draft quality.
	 */
	private function assign_tier( $candidate_id, $score ) {
		$data_type   = HLN_Candidate_CPT::get_meta( $candidate_id, 'data_type' );
		$source_type = HLN_Candidate_CPT::get_meta( $candidate_id, 'source_type' );

		if ( 'result' === $data_type && 'official' === $source_type ) {
			return 1;
		}
		if ( $score >= 40 ) {
			return 2;
		}
		return 3;
	}

	/* =========================================================
	   REST — GET /hln/v1/trending (spec §5.2)
	========================================================= */

	public function register_routes() {
		register_rest_route( 'hln/v1', '/trending', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'handle_trending_request' ],
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		] );
	}

	public function handle_trending_request( WP_REST_Request $request ) {
		$region = $request->get_param( 'region' );

		$args = [
			'post_type'      => HLN_Candidate_CPT::POST_TYPE,
			'post_status'    => [ 'hln_new', 'hln_building', 'hln_ready', 'hln_changes_required' ],
			'posts_per_page' => 50,
			'meta_key'       => '_hln_trending_signal',
			'orderby'        => 'meta_value_num',
			'order'          => 'DESC',
		];
		if ( $region ) {
			$args['meta_query'] = [ [ 'key' => '_hln_region', 'value' => sanitize_text_field( $region ) ] ];
		}

		$candidates = get_posts( $args );
		$out        = [];
		foreach ( $candidates as $candidate ) {
			$duplicate_of = HLN_Candidate_CPT::get_meta( $candidate->ID, 'duplicate_of' );
			$out[] = [
				'id'              => $candidate->ID,
				'score'           => (float) HLN_Candidate_CPT::get_meta( $candidate->ID, 'trending_signal', 0 ),
				'region'          => HLN_Candidate_CPT::get_meta( $candidate->ID, 'region' ),
				'source'          => HLN_Candidate_CPT::get_meta( $candidate->ID, 'source_name' ),
				'story'           => get_the_title( $candidate->ID ),
				'type'            => HLN_Candidate_CPT::get_meta( $candidate->ID, 'story_type' ),
				'corroborated_by' => HLN_Candidate_CPT::get_meta( $candidate->ID, 'source_type' ),
				'duplicate'       => (bool) $duplicate_of,
				'action'          => $duplicate_of ? 'merge' : ( 1 === (int) HLN_Candidate_CPT::get_meta( $candidate->ID, 'tier' ) ? 'promote' : 'hold' ),
			];
		}

		return new WP_REST_Response( $out, 200 );
	}
}
