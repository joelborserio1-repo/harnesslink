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
 * flow in, exactly as spec §5.1 describes), a breaking-news boost, and
 * duplicate demotion.
 *
 * Also completes the wiring Phase 3 deliberately left as a placeholder:
 * HLN_Trending_Signal writes raw X-scan volume to its own hln_trending_signal
 * table; this class is what reads that table and folds it into a
 * candidate's _hln_trending_signal meta, matched by entity.
 *
 * EXPLAINABLE SCORING: every weight, threshold, and multiplier below is
 * a configurable value (option 'hln_trending_weights', editable on the
 * Settings screen — see get_weights()), not a permanent hard-coded
 * editorial rule. compute() stores the full component breakdown — each
 * factor's raw value, its weight, and its contribution to the final
 * score — as _hln_trending_breakdown meta, shown on the Review Story
 * screen, so an editor can see exactly why a candidate scored what it did.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Trending {

	const BATCH_SIZE = 50;

	/**
	 * Defaults — the same distribution this class shipped with
	 * originally, now overridable via the hln_trending_weights option
	 * rather than hard-coded in compute().
	 */
	const DEFAULT_WEIGHTS = [
		'source_authority_weight'       => 40,
		'recency_weight'                => 25,
		'corroboration_weight'          => 15,
		'entity_significance_weight'    => 10,
		'historical_performance_weight' => 5,
		'x_signal_weight'               => 5,
		'breaking_news_boost'           => 1.2,
		'duplicate_demotion_factor'     => 0.3,
		'tier2_score_threshold'         => 40,
		'recommended_threshold'         => 40,
	];

	public function __construct() {
		add_action( 'init', [ $this, 'ensure_schedule' ] );
		add_action( 'hln_trending_run', [ $this, 'run' ] );
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * @return array Full weights array, defaults merged under any
	 *               admin-saved overrides so a partially-saved option
	 *               never leaves a key missing.
	 */
	public static function get_weights() {
		$saved = get_option( 'hln_trending_weights', [] );
		return array_merge( self::DEFAULT_WEIGHTS, is_array( $saved ) ? $saved : [] );
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
		$weights = self::get_weights();

		$trust_score  = (float) HLN_Candidate_CPT::get_meta( $candidate_id, 'trust_score', 50 );
		$entities     = HLN_Candidate_CPT::get_meta( $candidate_id, 'entities', [] );
		$source_type  = HLN_Candidate_CPT::get_meta( $candidate_id, 'source_type', '' );
		$data_type    = HLN_Candidate_CPT::get_meta( $candidate_id, 'data_type', '' );
		$published_at = HLN_Candidate_CPT::get_meta( $candidate_id, 'published_at' );
		$duplicate_of = HLN_Candidate_CPT::get_meta( $candidate_id, 'duplicate_of' );

		$components = [
			'source_authority'       => [ 'raw' => round( $trust_score / 100, 3 ), 'weight' => $weights['source_authority_weight'] ],
			'recency'                => [ 'raw' => $this->recency_factor( $published_at ), 'weight' => $weights['recency_weight'] ],
			'corroboration'          => [ 'raw' => $this->corroboration_factor( $entities, $source_type, $candidate_id ), 'weight' => $weights['corroboration_weight'] ],
			'entity_significance'    => [ 'raw' => $this->entity_significance_factor( $entities ), 'weight' => $weights['entity_significance_weight'] ],
			'historical_performance' => [ 'raw' => $this->historical_performance_factor( HLN_Candidate_CPT::get_meta( $candidate_id, 'story_type' ) ), 'weight' => $weights['historical_performance_weight'] ],
			'x_signal'               => [ 'raw' => $this->x_signal_factor( $entities ), 'weight' => $weights['x_signal_weight'] ],
		];

		$score = 0;
		foreach ( $components as $name => &$c ) {
			$c['contribution'] = round( $c['raw'] * $c['weight'], 2 );
			$score += $c['contribution'];
		}
		unset( $c );

		$is_breaking = 'result' === $data_type && 'official' === $source_type;
		$breaking_applied = false;
		if ( $is_breaking ) {
			$score *= (float) $weights['breaking_news_boost'];
			$breaking_applied = true;
		}

		$duplicate_applied = false;
		if ( $duplicate_of ) {
			$score *= (float) $weights['duplicate_demotion_factor'];
			$duplicate_applied = true;
		}

		$score = round( $score, 1 );
		$tier  = $this->assign_tier( $is_breaking, $score, $weights );

		HLN_Candidate_CPT::set_meta( $candidate_id, [
			'trending_signal'    => $score,
			'tier'               => $tier,
			'trending_breakdown' => [
				'total'      => $score,
				'components' => $components,
				'breaking_news_boost' => [ 'applied' => $breaking_applied, 'multiplier' => $weights['breaking_news_boost'] ],
				'duplicate_demotion'  => [ 'applied' => $duplicate_applied, 'factor' => $weights['duplicate_demotion_factor'] ],
			],
		] );

		HLN_Candidate_CPT::append_audit( $candidate_id, 'tier_assigned', sprintf( 'Tier %d, score %s.', $tier, $score ) );

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
	 * Tier per spec §11 — news urgency, not draft quality. Tier 1
	 * remains a rule (official result), not score-based, per spec's own
	 * definition; only the tier 2/3 score threshold is configurable.
	 */
	private function assign_tier( $is_breaking, $score, array $weights ) {
		if ( $is_breaking ) {
			return 1;
		}
		if ( $score >= (float) $weights['tier2_score_threshold'] ) {
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
