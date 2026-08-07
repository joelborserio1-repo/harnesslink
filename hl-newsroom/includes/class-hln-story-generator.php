<?php
/**
 * HLN_Story_Generator — turns a Story Candidate + its matched template
 * (+ a race-intelligence record, where relevant) into format_outputs
 * (spec §14) via a single abstracted generator interface.
 *
 * Per Hard Requirement 4: the underlying content-generation provider is
 * never named or hardcoded anywhere in this file, its docblock, or any
 * other file in this plugin. It is resolved exclusively through the
 * 'hln_generation_provider' filter, which must return an object
 * implementing HLN_Generation_Provider_Interface. No provider ships with
 * this plugin — until one is configured, generation deterministically
 * produces a "Changes Required" result rather than fabricating prose
 * under a fake provider, which would misrepresent what this build
 * actually does.
 *
 * This class's own QC logic (names/dates present, template adherence,
 * headline strength) runs regardless of which provider is configured —
 * it is not part of "the provider" and stays in this codebase.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

interface HLN_Generation_Provider_Interface {
	/**
	 * @param  array $payload {candidate, template, racing_intelligence}
	 * @return array {brief, feature, social_snippet, summary, headlines[]}
	 */
	public function generate( array $payload );
}

interface HLN_Generator_Interface {
	/**
	 * @param  int $candidate_id
	 * @return bool True if the candidate reached hln_ready.
	 */
	public function generate_draft( $candidate_id );
}

class HLN_Story_Generator implements HLN_Generator_Interface {

	const WORD_COUNT_TOLERANCE = 0.35;
	const MIN_HEADLINE_WORDS = 5;
	const MAX_HEADLINE_WORDS = 16;
	const CLICKBAIT_PATTERNS = [ "won't believe", 'shocking', 'you need to see', '!!!', 'gone wrong', 'this one trick' ];

	public function generate_draft( $candidate_id ) {
		if ( $this->blocked_by_kill_switch( $candidate_id ) ) {
			HLN_Candidate_CPT::append_audit( $candidate_id, 'draft_generation_blocked', 'Blocked by the auto-publish kill switch.' );
			return false;
		}

		wp_update_post( [ 'ID' => $candidate_id, 'post_status' => 'hln_building' ] );

		$story_type = HLN_Candidate_CPT::get_meta( $candidate_id, 'story_type', 'news' );
		$template   = HLN_Templates::get( $story_type ) ?: HLN_Templates::get( 'news' );
		$intel      = $this->find_racing_intelligence( $candidate_id );

		$payload = [
			'candidate'            => $this->candidate_payload( $candidate_id ),
			'template'             => $template,
			'racing_intelligence'  => $intel,
		];

		$provider = apply_filters( 'hln_generation_provider', null, $payload );

		if ( ! is_object( $provider ) || ! ( $provider instanceof HLN_Generation_Provider_Interface ) ) {
			HLN_Candidate_CPT::set_meta( $candidate_id, [
				'quality_score' => 0,
				'qc_flags'      => [ 'No generation provider configured — hook the hln_generation_provider filter.' ],
				'template_id'   => $story_type,
				'template_version' => $template['template_version'] ?? 1,
			] );
			wp_update_post( [ 'ID' => $candidate_id, 'post_status' => 'hln_changes_required' ] );
			HLN_Candidate_CPT::append_audit( $candidate_id, 'draft_generated', 'No provider configured.' );
			return false;
		}

		$result = $provider->generate( $payload );
		$result = $this->normalise_result( $result );

		HLN_Candidate_CPT::append_audit( $candidate_id, 'draft_generated', 'Generation provider produced format_outputs.' );

		$qc_flags      = $this->run_qc( $candidate_id, $result, $template );
		$quality_score = max( 0, 100 - ( 10 * count( $qc_flags ) ) );

		HLN_Candidate_CPT::set_meta( $candidate_id, [
			'format_outputs'        => [
				'brief'          => $result['brief'],
				'feature'        => $result['feature'],
				'social_snippet' => $result['social_snippet'],
				'summary'        => $result['summary'],
			],
			'headline_alternatives' => $result['headlines'],
			'quality_score'         => $quality_score,
			'qc_flags'              => $qc_flags,
			'template_id'           => $story_type,
			'template_version'      => $template['template_version'] ?? 1,
			'is_premium'            => $template['is_premium_default'] ?? false,
			'planned_tags'          => $this->planned_tags( $candidate_id ),
			'planned_category'      => HLN_Templates::default_category_for( $this->region_display( $candidate_id ), HLN_Candidate_CPT::get_meta( $candidate_id, 'data_type' ) ),
		] );

		if ( ! empty( $result['feature'] ) ) {
			wp_update_post( [ 'ID' => $candidate_id, 'post_content' => wp_kses_post( $result['feature'] ) ] );
		}

		HLN_Candidate_CPT::append_audit( $candidate_id, 'qc_result', empty( $qc_flags ) ? 'Passed.' : implode( '; ', $qc_flags ) );

		$new_status = empty( $qc_flags ) ? 'hln_ready' : 'hln_changes_required';
		wp_update_post( [ 'ID' => $candidate_id, 'post_status' => $new_status ] );

		return 'hln_ready' === $new_status;
	}

	/* =========================================================
	   PAYLOAD ASSEMBLY
	========================================================= */

	private function candidate_payload( $candidate_id ) {
		$fields = [];
		foreach ( HLN_Candidate_CPT::META_KEYS as $key ) {
			$fields[ $key ] = HLN_Candidate_CPT::get_meta( $candidate_id, $key );
		}
		$fields['id']       = $candidate_id;
		$fields['headline'] = get_the_title( $candidate_id );
		return $fields;
	}

	/**
	 * Best-effort match against the feature-race calendar by shared
	 * words in the race name — no explicit candidate-to-calendar link
	 * exists yet (Phase 2's calendar adapter writes directly to
	 * hln_race_calendar, independent of the intake-log-driven candidate
	 * pipeline), so this is a heuristic bridge rather than a guaranteed one.
	 */
	private function find_racing_intelligence( $candidate_id ) {
		global $wpdb;
		$headline = get_the_title( $candidate_id );
		$words    = array_filter( preg_split( '/\s+/', $headline ), fn( $w ) => mb_strlen( $w ) > 3 );
		if ( empty( $words ) ) {
			return null;
		}

		$table = $wpdb->prefix . 'hln_race_calendar';
		foreach ( array_slice( $words, 0, 5 ) as $word ) {
			$id = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM $table WHERE race_name LIKE %s LIMIT 1",
				'%' . $wpdb->esc_like( $word ) . '%'
			) );
			if ( $id ) {
				return HLN_Racing_Intelligence::get_for_entry( (int) $id );
			}
		}
		return null;
	}

	/* =========================================================
	   RESULT NORMALISATION
	========================================================= */

	private function normalise_result( $result ) {
		$result = is_array( $result ) ? $result : [];
		return array_merge( [
			'brief'          => '',
			'feature'        => '',
			'social_snippet' => '',
			'summary'        => '',
			'headlines'      => [],
		], $result );
	}

	/* =========================================================
	   QUALITY CONTROL
	   Runs regardless of provider — this is this class's own code, not
	   the swappable "provider."
	========================================================= */

	private function run_qc( $candidate_id, array $result, array $template ) {
		$flags = [];

		if ( empty( trim( $result['feature'] ) ) ) {
			$flags[] = 'Provider returned no feature text.';
			return $flags; // Nothing further to check meaningfully.
		}

		$entities = HLN_Candidate_CPT::get_meta( $candidate_id, 'entities', [] );
		$missing  = [];
		foreach ( array_slice( $entities, 0, 5 ) as $entity ) {
			if ( false === stripos( $result['feature'], $entity ) ) {
				$missing[] = $entity;
			}
		}
		if ( ! empty( $missing ) ) {
			$flags[] = 'Missing entity in draft: ' . implode( ', ', $missing );
		}

		$word_count = str_word_count( wp_strip_all_tags( $result['feature'] ) );
		$target     = $template['target_word_count'] ?? 500;
		$tolerance  = $target * self::WORD_COUNT_TOLERANCE;
		if ( $word_count < ( $target - $tolerance ) || $word_count > ( $target + $tolerance ) ) {
			$flags[] = sprintf( 'Style violation: word count %d outside target %d ± %.0f%%.', $word_count, $target, self::WORD_COUNT_TOLERANCE * 100 );
		}

		if ( ! empty( $template['source_credit_required'] ) && empty( HLN_Candidate_CPT::get_meta( $candidate_id, 'source_credit' ) ) ) {
			$flags[] = 'Missing required source_credit for this template.';
		}

		foreach ( $result['headlines'] as $headline ) {
			$issue = $this->headline_issue( $headline );
			if ( $issue ) {
				$flags[] = $issue;
				break; // One headline-strength flag is enough.
			}
		}
		if ( empty( $result['headlines'] ) ) {
			$flags[] = 'No headline alternatives produced.';
		}

		return $flags;
	}

	private function headline_issue( $headline ) {
		$word_count = str_word_count( $headline );
		if ( $word_count < self::MIN_HEADLINE_WORDS || $word_count > self::MAX_HEADLINE_WORDS ) {
			return 'Headline strength: word count outside house range.';
		}
		$lower = strtolower( $headline );
		foreach ( self::CLICKBAIT_PATTERNS as $pattern ) {
			if ( false !== strpos( $lower, $pattern ) ) {
				return 'Headline strength: clickbait phrasing detected.';
			}
		}
		return null;
	}

	/* =========================================================
	   TAGS / CATEGORY
	========================================================= */

	private function planned_tags( $candidate_id ) {
		$entities = HLN_Candidate_CPT::get_meta( $candidate_id, 'entities', [] );
		$byline   = HLN_Candidate_CPT::get_meta( $candidate_id, 'guest_author' ) ?: HLN_Candidate_CPT::get_meta( $candidate_id, 'byline' );
		$tags     = array_slice( $entities, 0, 5 );
		if ( $byline ) {
			$tags[] = $byline; // Hard Requirement 8: author is one of the applied tags, not a separate field.
		}
		return array_values( array_unique( array_filter( $tags ) ) );
	}

	private function region_display( $candidate_id ) {
		$region = HLN_Candidate_CPT::get_meta( $candidate_id, 'region', '' );
		$map = [ 'usa' => 'USA', 'canada' => 'Canada', 'australia' => 'Australia', 'new_zealand' => 'New Zealand', 'europe' => 'Europe' ];
		return $map[ $region ] ?? ucfirst( $region );
	}

	/* =========================================================
	   KILL SWITCH (Hard Requirement 5 / spec §7.1)
	========================================================= */

	private function blocked_by_kill_switch( $candidate_id ) {
		if ( get_option( 'hln_global_kill_switch', false ) ) {
			return true;
		}
		$source_slug = null;
		global $wpdb;
		$log_id = HLN_Candidate_CPT::get_meta( $candidate_id, 'source_intake_log_id' );
		if ( $log_id ) {
			$source_slug = $wpdb->get_var( $wpdb->prepare(
				"SELECT source_slug FROM {$wpdb->prefix}hln_intake_log WHERE id = %d", (int) $log_id
			) );
		}
		if ( ! $source_slug ) {
			return false;
		}
		$killed = get_option( 'hln_source_kill_switches', [] );
		return ! empty( $killed[ $source_slug ] );
	}
}
