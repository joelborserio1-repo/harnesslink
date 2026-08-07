<?php
/**
 * HLN_Templates — style templates stored as data (spec §12), not
 * hardcoded into any prompt string, so an editor can change one without
 * a code change. Follows the exact same seed-plus-admin-override pattern
 * already established by HLN_Sources, rather than a new convention.
 *
 * One template per story_type: news, preview, result, feature, breeding,
 * industry. Result and Feature are seeded with the concrete rules from
 * spec §12's worked examples; Preview's source_credit requirement is left
 * as a toggle defaulted to required, flagged for confirmation rather than
 * assumed either way, per spec. News/Breeding/Industry have no worked
 * example in the spec, so they're seeded with placeholder structure only.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Templates {

	const STORY_TYPES = [ 'news', 'preview', 'result', 'feature', 'breeding', 'industry' ];

	public static function get_all() {
		$templates = [

			'result' => [
				'label'                    => __( 'Result', 'hl-newsroom' ),
				'target_word_count'        => 500,
				'structure_order'          => [ 'first_mention_formula', 'draw', 'early_pace', 'mid_race_moves', 'margin_time', 'record_note', 'closing_link' ],
				'headline_formula'         => 'entity_first',
				'first_mention_formula'    => '%s (**%s**)', // "Name (**Sire**)"
				'source_credit_required'   => true,
				'source_credit_confirmed'  => true,
				'byline_case'              => 'capitalized', // "By"
				'pull_quote_style'         => 'bold_italic',
				'closing_link_required'    => true, // Links to the governing body's official results page.
				'is_premium_default'       => false,
				'template_version'         => 1,
			],

			'feature' => [
				'label'                    => __( 'Feature', 'hl-newsroom' ),
				'target_word_count'        => 900,
				'structure_order'          => [ 'framing_sentence', 'biographical_detail', 'chronological_body', 'extended_quotes' ],
				'headline_formula'         => 'narrative',
				'source_credit_required'   => false, // Original interview-based reporting.
				'source_credit_confirmed'  => true,
				'byline_case'              => 'lowercase', // "by"
				'pull_quote_style'         => 'extended_first_person',
				'closing_link_required'    => false,
				'is_premium_default'       => false,
				'template_version'         => 1,
			],

			'preview' => [
				'label'                    => __( 'Preview', 'hl-newsroom' ),
				'target_word_count'        => 600,
				'structure_order'          => [ 'image_caption', 'insider_quote', 'historical_context', 'barrier_draw_field_breakdown' ],
				'headline_formula'         => 'entity_first',
				'source_credit_required'   => true, // Default — not yet decided per spec §12, flagged for confirmation.
				'source_credit_confirmed'  => false,
				'byline_case'              => 'capitalized',
				'pull_quote_style'         => 'insider_lead',
				'closing_link_required'    => false,
				'is_premium_default'       => false,
				'template_version'         => 1,
			],

			// No worked example exists in spec §12 for the three below —
			// seeded with the same schema and a placeholder structure
			// order rather than invented house style. Confirm with
			// editorial and update via the Style Templates screen.
			'news' => [
				'label'                    => __( 'News', 'hl-newsroom' ),
				'target_word_count'        => 350,
				'structure_order'          => [ 'lede', 'key_facts', 'context', 'closing_link' ],
				'headline_formula'         => 'entity_first',
				'source_credit_required'   => true,
				'source_credit_confirmed'  => false,
				'byline_case'              => 'capitalized',
				'pull_quote_style'         => 'none',
				'closing_link_required'    => false,
				'is_premium_default'       => false,
				'template_version'         => 1,
			],
			'breeding' => [
				'label'                    => __( 'Breeding', 'hl-newsroom' ),
				'target_word_count'        => 450,
				'structure_order'          => [ 'lede', 'pedigree_facts', 'context' ],
				'headline_formula'         => 'entity_first',
				'source_credit_required'   => true,
				'source_credit_confirmed'  => false,
				'byline_case'              => 'capitalized',
				'pull_quote_style'         => 'none',
				'closing_link_required'    => false,
				'is_premium_default'       => false,
				'template_version'         => 1,
			],
			'industry' => [
				'label'                    => __( 'Industry', 'hl-newsroom' ),
				'target_word_count'        => 500,
				'structure_order'          => [ 'lede', 'key_facts', 'analysis' ],
				'headline_formula'         => 'entity_first',
				'source_credit_required'   => true,
				'source_credit_confirmed'  => false,
				'byline_case'              => 'capitalized',
				'pull_quote_style'         => 'none',
				'closing_link_required'    => false,
				'is_premium_default'       => false,
				'template_version'         => 1,
			],
		];

		$templates = apply_filters( 'hln_templates', $templates );

		$overrides = get_option( 'hln_template_overrides', [] );
		foreach ( $overrides as $story_type => $fields ) {
			if ( ! isset( $templates[ $story_type ] ) || ! is_array( $fields ) ) {
				continue;
			}
			// Any admin edit bumps the version so drafts can record which
			// version produced them (spec §12's closing requirement).
			$fields['template_version'] = ( $templates[ $story_type ]['template_version'] ?? 1 ) + 1;
			$templates[ $story_type ]   = array_merge( $templates[ $story_type ], $fields );
		}

		return $templates;
	}

	/**
	 * @param  string $story_type
	 * @return array|null
	 */
	public static function get( $story_type ) {
		$all = self::get_all();
		return $all[ $story_type ] ?? null;
	}

	/**
	 * @param string $story_type
	 * @param array  $fields
	 */
	public static function save_override( $story_type, array $fields ) {
		if ( ! in_array( $story_type, self::STORY_TYPES, true ) ) {
			return;
		}
		$overrides = get_option( 'hln_template_overrides', [] );
		$overrides[ $story_type ] = $fields;
		update_option( 'hln_template_overrides', $overrides );
	}

	/**
	 * Default category for a template, derived from region + data_type
	 * per spec §12.1 — not stored on the template itself since it
	 * depends on the candidate's own region/data_type at draft time.
	 *
	 * @param  string $region_display e.g. "USA"
	 * @param  string $data_type
	 * @return string[] [region_category, subcategory]
	 */
	public static function default_category_for( $region_display, $data_type ) {
		$subcategory_map = [
			'result'  => 'Results',
			'fixture' => 'Entries',
			'field'   => 'Entries',
		];
		$subcategory = $subcategory_map[ $data_type ] ?? 'News';
		return [ $region_display, $subcategory ];
	}
}
