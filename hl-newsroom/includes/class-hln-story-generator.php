<?php
/**
 * HLN_Story_Generator — turns a Story Candidate + its matched template
 * (+ a race-intelligence record, where relevant) into format_outputs
 * (spec §14) via a single abstracted generator interface.
 *
 * ============================================================
 * PROVIDER INTEGRATION CONTRACT (Hard Requirement 4)
 * ============================================================
 * The underlying content-generation provider is never named or
 * hardcoded anywhere in this file, its docblock, or any other file in
 * this plugin. It is resolved exclusively through configuration/hooks:
 *
 *   1. The 'hln_generation_provider' filter — the primary path. Hook it
 *      to return an object implementing HLN_Generation_Provider_Interface:
 *
 *        add_filter( 'hln_generation_provider', function ( $provider, $payload ) {
 *            return new My_Custom_Provider(); // Defined in your own
 *                                              // mu-plugin/integration —
 *                                              // never in this plugin.
 *        }, 10, 2 );
 *
 *   2. The 'hln_generation_provider_class' option — an alternative,
 *      admin-configurable path (set on the Settings screen) for a
 *      provider that doesn't need per-request filter logic: a fully-
 *      qualified class name, autoloadable, implementing the same
 *      interface, instantiated with no constructor arguments. Used only
 *      when the filter above returns nothing.
 *
 * No provider ships with this plugin. Architecture:
 *
 *   HLN_Story_Generator -> hln_generation_provider -> external configured implementation
 *
 * INPUT SCHEMA — the $payload array passed to generate():
 *   [
 *     'candidate' => [
 *       // Every HLN_Candidate_CPT::META_KEYS field, plus:
 *       'id'       => (int) candidate post ID,
 *       'headline' => (string) current post title,
 *       // Notable fields: source_name, source_type, source_credit,
 *       // region, governing_body, original_url, published_at,
 *       // entities (string[]), data_type, images/video (rights-shape
 *       // arrays), trust_score, story_type, race_calendar_id (int|null).
 *     ],
 *     'template' => [
 *       // The full HLN_Templates::get( story_type ) array: label,
 *       // target_word_count, structure_order (string[]),
 *       // headline_formula, source_credit_required (bool), byline_case,
 *       // is_premium_default (bool), template_version (int), etc.
 *     ],
 *     'racing_intelligence' => array|null,
 *       // HLN_Racing_Intelligence's assembled payload when this
 *       // candidate has a race_calendar_id (direct link) or a fuzzy
 *       // fallback match found one; null otherwise. Never fabricated.
 *   ]
 *
 * OUTPUT SCHEMA — generate() must return:
 *   [
 *     'brief'          => (string) 100-150 words,
 *     'feature'        => (string) full house-style article,
 *     'social_snippet' => (string) short, carries the story's own link,
 *     'summary'        => (string) internal only, never published,
 *     'headlines'      => (string[]) 2-3 alternatives,
 *   ]
 *
 * FAILURE HANDLING:
 *   - A thrown exception (any \Throwable) is caught here and treated as
 *     a clean failure: no partial state is trusted, the candidate lands
 *     in Changes Required with the exception message as a QC flag, and
 *     'generation_failed' is written to the audit log.
 *   - A non-array return, or an array missing/mistyping a required key,
 *     fails validate_provider_result() the same way — routed to Changes
 *     Required, never partially accepted.
 *   - No placeholder or fabricated prose is ever produced by this class
 *     in any failure path.
 *
 * ADMIN STATUS: HLN_Story_Generator::get_provider_status() powers the
 * "Generation Provider" panel on the Settings screen, so an admin can
 * see at a glance whether generation is configured and available
 * without triggering a real generation call.
 *
 * This class's own QC logic (names/dates present, template adherence,
 * headline strength) runs regardless of which provider is configured —
 * it is not part of "the provider" and stays in this codebase.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Providers should throw this (or let it propagate from inside generate())
 * when they can't produce a usable result, rather than returning partial
 * or empty data — HLN_Story_Generator treats any \Throwable the same way,
 * but a typed exception documents intent at the call site.
 */
class HLN_Generation_Provider_Exception extends \Exception {}

interface HLN_Generation_Provider_Interface {
	/**
	 * @param  array $payload See the INPUT SCHEMA in class-hln-story-generator.php.
	 * @return array           See the OUTPUT SCHEMA in the same file.
	 * @throws HLN_Generation_Provider_Exception|\Throwable On any failure —
	 *         do not return partial/empty data to signal failure.
	 */
	public function generate( array $payload );

	/**
	 * A cheap configuration/connectivity check for the admin status
	 * panel — must NOT perform a full generation call, and must accept
	 * a null $payload (the status check has no real candidate to send).
	 *
	 * @param  array|null $payload
	 * @return bool
	 */
	public function is_available( $payload = null );
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
	const REQUIRED_RESULT_KEYS = [ 'brief', 'feature', 'social_snippet', 'summary', 'headlines' ];

	public function generate_draft( $candidate_id ) {
		$source_slug = HLN_Kill_Switch::source_slug_for_candidate( $candidate_id );
		if ( HLN_Kill_Switch::blocks_automatic_advancement( $source_slug ) ) {
			HLN_Audit_Log::log( 'generation_blocked', 'Blocked by the automation kill switch.', $candidate_id, $source_slug );
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

		HLN_Candidate_CPT::append_audit( $candidate_id, 'generation_requested', sprintf( 'Story type: %s, template v%d.', $story_type, $template['template_version'] ?? 1 ) );

		$provider = $this->resolve_provider( $payload );

		if ( ! $provider ) {
			$this->fail_generation( $candidate_id, $story_type, $template, 'No generation provider configured — set the hln_generation_provider filter or the hln_generation_provider_class option.' );
			return false;
		}

		try {
			$result = $provider->generate( $payload );
		} catch ( \Throwable $e ) {
			$this->fail_generation( $candidate_id, $story_type, $template, 'Generation provider threw an exception: ' . $e->getMessage() );
			return false;
		}

		$validation_errors = $this->validate_provider_result( $result );
		if ( ! empty( $validation_errors ) ) {
			$this->fail_generation( $candidate_id, $story_type, $template, 'Provider returned an invalid result: ' . implode( '; ', $validation_errors ) );
			return false;
		}

		HLN_Candidate_CPT::append_audit( $candidate_id, 'generation_completed', 'Provider produced a structurally valid result.' );

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

		HLN_Candidate_CPT::append_audit( $candidate_id, empty( $qc_flags ) ? 'qc_passed' : 'qc_failed', empty( $qc_flags ) ? 'Passed.' : implode( '; ', $qc_flags ) );

		$new_status = empty( $qc_flags ) ? 'hln_ready' : 'hln_changes_required';
		wp_update_post( [ 'ID' => $candidate_id, 'post_status' => $new_status ] );

		return 'hln_ready' === $new_status;
	}

	private function fail_generation( $candidate_id, $story_type, array $template, $reason ) {
		HLN_Candidate_CPT::set_meta( $candidate_id, [
			'quality_score'     => 0,
			'qc_flags'          => [ $reason ],
			'template_id'       => $story_type,
			'template_version'  => $template['template_version'] ?? 1,
		] );
		wp_update_post( [ 'ID' => $candidate_id, 'post_status' => 'hln_changes_required' ] );
		HLN_Candidate_CPT::append_audit( $candidate_id, 'generation_failed', $reason );
	}

	/* =========================================================
	   PROVIDER RESOLUTION (configuration/hooks only — Hard Requirement 4)
	========================================================= */

	/**
	 * @param  array $payload
	 * @return HLN_Generation_Provider_Interface|null
	 */
	private function resolve_provider( array $payload = null ) {
		$provider = apply_filters( 'hln_generation_provider', null, $payload );

		if ( ! is_object( $provider ) || ! ( $provider instanceof HLN_Generation_Provider_Interface ) ) {
			$class = get_option( 'hln_generation_provider_class', '' );
			if ( $class && class_exists( $class ) ) {
				try {
					$provider = new $class();
				} catch ( \Throwable $e ) {
					return null;
				}
			}
		}

		return ( is_object( $provider ) && $provider instanceof HLN_Generation_Provider_Interface ) ? $provider : null;
	}

	/**
	 * Powers the admin "Generation Provider" status panel. Never
	 * triggers a real generation call — only is_available(), which
	 * providers must implement as a cheap check.
	 *
	 * @return array {configured: bool, class: string|null, available: bool|null, error: string|null}
	 */
	public static function get_provider_status() {
		$instance = new self();
		$provider = $instance->resolve_provider( null );

		if ( ! $provider ) {
			return [ 'configured' => false, 'class' => null, 'available' => false, 'error' => null ];
		}

		try {
			$available = (bool) $provider->is_available( null );
			return [ 'configured' => true, 'class' => get_class( $provider ), 'available' => $available, 'error' => null ];
		} catch ( \Throwable $e ) {
			return [ 'configured' => true, 'class' => get_class( $provider ), 'available' => false, 'error' => $e->getMessage() ];
		}
	}

	/* =========================================================
	   RESULT VALIDATION
	========================================================= */

	/**
	 * @param  mixed $result
	 * @return string[] Validation errors — empty means valid.
	 */
	private function validate_provider_result( $result ) {
		$errors = [];

		if ( ! is_array( $result ) ) {
			return [ 'Provider did not return an array.' ];
		}

		foreach ( self::REQUIRED_RESULT_KEYS as $key ) {
			if ( ! array_key_exists( $key, $result ) ) {
				$errors[] = "Missing required key: {$key}.";
				continue;
			}
			if ( 'headlines' === $key ) {
				if ( ! is_array( $result['headlines'] ) ) {
					$errors[] = 'headlines must be an array.';
				}
			} elseif ( ! is_string( $result[ $key ] ) ) {
				$errors[] = "{$key} must be a string.";
			}
		}

		return $errors;
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
	 * Racing intelligence lookup: primarily the deterministic
	 * race_calendar_id link set by HLN_Race_Candidate_Link at candidate
	 * creation time. Fuzzy headline/race-name matching is kept only as
	 * a fallback for candidates with no race_calendar_id — e.g. a
	 * general news-channel candidate that happens to reference a race
	 * but wasn't created through the calendar-linking pipeline.
	 */
	private function find_racing_intelligence( $candidate_id ) {
		$calendar_id = HLN_Candidate_CPT::get_meta( $candidate_id, 'race_calendar_id' );
		if ( $calendar_id ) {
			return HLN_Racing_Intelligence::get_for_entry( (int) $calendar_id );
		}

		return $this->fuzzy_find_racing_intelligence( $candidate_id );
	}

	private function fuzzy_find_racing_intelligence( $candidate_id ) {
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
			$issue = is_string( $headline ) ? $this->headline_issue( $headline ) : 'Headline strength: non-string headline returned.';
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
}
