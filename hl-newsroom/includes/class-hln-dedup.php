<?php
/**
 * HLN_Dedup — duplicate detection against the HarnessLink archive and
 * other pending Story Candidates (spec §10).
 *
 * Two passes:
 *   exact_url_check()  – cheap, called by HLN_Triage right after a
 *                         candidate is created: does this URL already
 *                         exist as a published post or another candidate?
 *   run() (scheduled)   – the fuzzy pass: entity overlap + near-duplicate
 *                         headline, run periodically across all 'hln_new'
 *                         candidates.
 *
 * A match sets duplicate_of — duplicates are demoted in trending ranking,
 * never deleted, so an editor can still choose a follow-up angle.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Dedup {

	/** Title similarity percentage (via similar_text) above which two headlines count as near-duplicates. */
	const TITLE_SIMILARITY_THRESHOLD = 70;
	const BATCH_SIZE = 25;

	public function __construct() {
		add_action( 'init', [ $this, 'ensure_schedule' ] );
		add_action( 'hln_dedup_run', [ $this, 'run' ] );
	}

	public function ensure_schedule() {
		if ( ! wp_next_scheduled( 'hln_dedup_run' ) ) {
			wp_schedule_event( time(), HLN_Cron_Utils::schedule_key_for_frequency( '15m' ), 'hln_dedup_run' );
		}
	}

	/* =========================================================
	   EXACT-URL CHECK (called from Stage B)
	========================================================= */

	/**
	 * @param int $candidate_id
	 */
	public static function exact_url_check( $candidate_id ) {
		$url = HLN_Candidate_CPT::get_meta( $candidate_id, 'original_url' );
		if ( empty( $url ) ) {
			return;
		}

		$existing_post = self::find_published_post_by_url( $url );
		if ( $existing_post ) {
			self::mark_duplicate( $candidate_id, $existing_post, 'Exact URL match against a published post.' );
			return;
		}

		$existing_candidate = self::find_other_candidate_by_url( $url, $candidate_id );
		if ( $existing_candidate ) {
			self::mark_duplicate( $candidate_id, $existing_candidate, 'Exact URL match against another candidate.' );
		}
	}

	private static function find_published_post_by_url( $url ) {
		global $wpdb;
		$post_id = $wpdb->get_var( $wpdb->prepare(
			"SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_hln_original_url' AND meta_value = %s LIMIT 1",
			$url
		) );
		return $post_id ? (int) $post_id : 0;
	}

	private static function find_other_candidate_by_url( $url, $exclude_id ) {
		global $wpdb;
		$post_id = $wpdb->get_var( $wpdb->prepare(
			"SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_hln_original_url' AND meta_value = %s AND post_id != %d LIMIT 1",
			$url, $exclude_id
		) );
		return $post_id ? (int) $post_id : 0;
	}

	/* =========================================================
	   FUZZY PASS (scheduled)
	========================================================= */

	public function run() {
		$candidates = get_posts( [
			'post_type'      => HLN_Candidate_CPT::POST_TYPE,
			'post_status'    => 'hln_new',
			'posts_per_page' => self::BATCH_SIZE,
			'meta_query'     => [ [ 'key' => '_hln_duplicate_of', 'compare' => 'NOT EXISTS' ] ],
		] );

		foreach ( $candidates as $candidate ) {
			$this->check_candidate( $candidate->ID );
		}
	}

	private function check_candidate( $candidate_id ) {
		$title    = get_the_title( $candidate_id );
		$entities = HLN_Candidate_CPT::get_meta( $candidate_id, 'entities', [] );

		$match = $this->find_similar_archive_post( $title, $entities, $candidate_id );
		if ( $match ) {
			self::mark_duplicate( $candidate_id, $match, 'Near-duplicate headline/entity match against the archive.' );
			return;
		}

		$match = $this->find_similar_candidate( $title, $entities, $candidate_id );
		if ( $match ) {
			self::mark_duplicate( $candidate_id, $match, 'Near-duplicate headline/entity match against another candidate.' );
		}
	}

	private function find_similar_archive_post( $title, array $entities, $exclude_id ) {
		if ( empty( $entities ) ) {
			return 0;
		}
		$query = new WP_Query( [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			's'              => implode( ' ', array_slice( $entities, 0, 3 ) ),
			'posts_per_page' => 5,
			'no_found_rows'  => true,
			'date_query'     => [ [ 'after' => '-14 days' ] ],
		] );

		foreach ( $query->posts as $post ) {
			if ( $this->titles_similar( $title, get_the_title( $post ) ) ) {
				return (int) $post->ID;
			}
		}
		return 0;
	}

	private function find_similar_candidate( $title, array $entities, $exclude_id ) {
		$others = get_posts( [
			'post_type'      => HLN_Candidate_CPT::POST_TYPE,
			'post_status'    => array_diff( HLN_Candidate_CPT::STATUSES, [ 'hln_rejected', 'hln_archived' ] ),
			'posts_per_page' => 50,
			'exclude'        => [ $exclude_id ],
			'date_query'     => [ [ 'after' => '-14 days' ] ],
		] );

		foreach ( $others as $other ) {
			if ( $this->titles_similar( $title, get_the_title( $other ) ) ) {
				return (int) $other->ID;
			}
		}
		return 0;
	}

	private function titles_similar( $a, $b ) {
		if ( empty( $a ) || empty( $b ) ) {
			return false;
		}
		similar_text( strtolower( $a ), strtolower( $b ), $percent );
		return $percent >= self::TITLE_SIMILARITY_THRESHOLD;
	}

	/* =========================================================
	   SHARED
	========================================================= */

	private static function mark_duplicate( $candidate_id, $matched_id, $reason ) {
		HLN_Candidate_CPT::set_meta( $candidate_id, [ 'duplicate_of' => $matched_id ] );
		HLN_Candidate_CPT::append_audit( $candidate_id, 'duplicate_check', $reason . ' (matched #' . $matched_id . ')' );
	}
}
