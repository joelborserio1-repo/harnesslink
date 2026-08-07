<?php
/**
 * HLN_Stewards_Parser — dedicated parser for stewards reports.
 *
 * Called from within an intake channel (email attachments today; the
 * monitored-page race-data path in Phase 2 item 2 for bodies that publish
 * rulings as a web page rather than a PDF) whenever HLN_Parsing_Utils::
 * looks_like_stewards_report() flags a document as stewards material,
 * rather than every channel reimplementing this logic itself.
 *
 * Enforces Hard Requirement 11: any USTA stewards/ruling content is
 * unconditionally marked requires_source_clearance = true and never
 * produces content usable for generation — republishing/rewriting USTA
 * stewards material without written consent is restricted under USTA's
 * published terms, and none has been obtained. Other jurisdictions are
 * not currently known to carry the same restriction but still record a
 * confirm_status so a restriction can be applied later without a schema
 * change.
 *
 * Feature-race calendars do NOT go through this parser — they are
 * lower-risk structured data handled by HLN_Race_Data's standard adapter.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Stewards_Parser {

	/** Governing bodies whose stewards/ruling data is held out of generation. */
	const RESTRICTED_GOVERNING_BODIES = [ 'United States Trotting Association' ];
	const RESTRICTED_SOURCE_SLUGS     = [ 'usta' ];

	const TAG_KEYWORDS = [
		'suspensions'       => [ 'suspend', 'suspension', 'suspended' ],
		'penalties'         => [ 'penalty', 'penalties', 'fine', 'fined' ],
		'protests'          => [ 'protest', 'objection', 'inquiry' ],
		'equipment_changes' => [ 'equipment change', 'blinkers', 'hopples', 'shoe change', 'gear change' ],
		'vet_findings'      => [ 'veterinary', 'vet finding', 'lame', 'laceration', 'bleeder', 'treadmill' ],
	];

	/** Sentences retained per tag category — kept small; this is a log entry, not a copy of the report. */
	const MAX_MATCHES_PER_TAG = 3;

	/**
	 * @param  string     $text          Extracted stewards-report text (from PDF or page).
	 * @param  array|null $source_entry  Matched HLN_Sources entry, if any.
	 * @return array {
	 *   @type string   headline
	 *   @type string   body_excerpt
	 *   @type string[] entities
	 *   @type array    tags {suspensions[], penalties[], protests[], equipment_changes[], vet_findings[]}
	 *   @type bool     requires_source_clearance
	 *   @type string   confirm_status  'restricted' | 'unconfirmed'
	 * }
	 */
	public static function parse( $text, $source_entry = null ) {
		$text = trim( (string) $text );

		$sentences = preg_split( '/(?<=[.!?])\s+/', $text );
		$tags      = [];
		foreach ( self::TAG_KEYWORDS as $tag => $keywords ) {
			$tags[ $tag ] = self::extract_tagged_sentences( $sentences, $keywords );
		}

		$restricted = self::is_restricted( $source_entry );

		return [
			'headline'                  => self::first_line( $text ),
			'body_excerpt'              => HLN_Parsing_Utils::extract_short_excerpt( $text ),
			'entities'                  => HLN_Parsing_Utils::extract_entities_naive( $text ),
			'tags'                      => $tags,
			'requires_source_clearance' => $restricted,
			'confirm_status'            => $restricted ? 'restricted' : 'unconfirmed',
		];
	}

	/**
	 * @param  array|null $source_entry
	 * @return bool
	 */
	public static function is_restricted( $source_entry ) {
		if ( empty( $source_entry ) ) {
			return false;
		}
		if ( ! empty( $source_entry['_slug'] ) && in_array( $source_entry['_slug'], self::RESTRICTED_SOURCE_SLUGS, true ) ) {
			return true;
		}
		$governing_body = $source_entry['governing_body'] ?? '';
		return in_array( $governing_body, self::RESTRICTED_GOVERNING_BODIES, true );
	}

	private static function extract_tagged_sentences( array $sentences, array $keywords ) {
		$matches = [];
		foreach ( $sentences as $sentence ) {
			$sentence_lower = strtolower( $sentence );
			foreach ( $keywords as $keyword ) {
				if ( false !== strpos( $sentence_lower, $keyword ) ) {
					$matches[] = wp_trim_words( trim( $sentence ), 25, '…' );
					break;
				}
			}
			if ( count( $matches ) >= self::MAX_MATCHES_PER_TAG ) {
				break;
			}
		}
		return $matches;
	}

	private static function first_line( $text ) {
		$lines = preg_split( '/\r\n|\r|\n/', trim( $text ) );
		foreach ( $lines as $line ) {
			$line = trim( $line );
			if ( '' !== $line ) {
				return wp_trim_words( $line, 20, '…' );
			}
		}
		return '';
	}
}
