<?php
/**
 * HLN_Parsing_Utils — shared extraction helpers for every intake channel.
 *
 * Used by HLN_Email_Intake (PDF attachments), HLN_Race_Data (monitored-page
 * fallback + PDF results/fields where a body publishes them as PDF), and
 * HLN_Stewards_Parser (stewards reports, frequently PDF). Kept in one place
 * so every channel enforces Hard Requirement 1 the same way: extraction
 * stops at headline/byline/date/short excerpt/entities/one short quote —
 * never a full source article body.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Parsing_Utils {

	/** Hard cap on any excerpt this class returns, in words. */
	const MAX_EXCERPT_WORDS = 60;

	/** Hard cap on a single retained quote, in words. */
	const MAX_QUOTE_WORDS = 40;

	/* =========================================================
	   PDF TEXT EXTRACTION
	   Dependency-free, best-effort extractor for standard
	   (non-encrypted, non-scanned) text PDFs — decodes FlateDecode
	   content streams and pulls text shown via Tj/TJ operators.
	   Scanned/image-only PDFs will return an empty string; that is
	   an accepted limitation for this phase rather than a fatal error.
	========================================================= */

	/**
	 * @param  string $pdf_binary Raw PDF file contents.
	 * @return string Extracted plain text (best effort, may be empty).
	 */
	public static function extract_pdf_text( $pdf_binary ) {
		if ( empty( $pdf_binary ) || ! function_exists( 'gzuncompress' ) ) {
			return '';
		}

		$streams = self::extract_pdf_streams( $pdf_binary );
		$text    = '';

		foreach ( $streams as $stream ) {
			$text .= self::decode_pdf_text_operators( $stream ) . "\n";
		}

		$text = preg_replace( '/[ \t]+/', ' ', $text );
		$text = preg_replace( '/\n{3,}/', "\n\n", $text );

		return trim( $text );
	}

	/**
	 * Best-effort table extraction: groups consecutive lines that look
	 * like whitespace/tab-delimited rows into a simple array-of-rows
	 * structure. This is a heuristic, not a layout-aware table parser —
	 * good enough for the simple tabular blocks common in stewards
	 * reports and results PDFs, not a general PDF table solution. A
	 * dedicated PDF/table library is the natural upgrade path if that
	 * ever becomes worth the added dependency.
	 *
	 * @param  string $pdf_binary
	 * @return array[] Array of rows, each row an array of cell strings.
	 */
	public static function extract_pdf_tables( $pdf_binary ) {
		$text  = self::extract_pdf_text( $pdf_binary );
		if ( '' === $text ) {
			return [];
		}

		$rows = [];
		foreach ( explode( "\n", $text ) as $line ) {
			$line = trim( $line );
			if ( '' === $line ) {
				continue;
			}
			$cells = preg_split( '/\s{2,}|\t+/', $line );
			if ( count( $cells ) >= 2 ) {
				$rows[] = array_map( 'trim', $cells );
			}
		}

		return $rows;
	}

	private static function extract_pdf_streams( $pdf_binary ) {
		$streams = [];
		if ( ! preg_match_all( '/stream\r?\n(.*?)\r?\nendstream/s', $pdf_binary, $matches ) ) {
			return $streams;
		}

		foreach ( $matches[1] as $raw ) {
			$decoded = @gzuncompress( $raw );
			if ( false === $decoded ) {
				// Not FlateDecode (or already-decoded) — try the raw block as-is.
				$decoded = $raw;
			}
			$streams[] = $decoded;
		}

		return $streams;
	}

	private static function decode_pdf_text_operators( $stream ) {
		$text = '';

		// Text-showing operators: (string) Tj   and   [ (a) -120 (b) ] TJ
		if ( preg_match_all( '/\((?:[^()\\\\]|\\\\.)*\)\s*T[jJ]/', $stream, $tj ) ) {
			foreach ( $tj[0] as $chunk ) {
				if ( preg_match_all( '/\((?:[^()\\\\]|\\\\.)*\)/', $chunk, $strings ) ) {
					foreach ( $strings[0] as $s ) {
						$text .= self::unescape_pdf_string( substr( $s, 1, -1 ) ) . ' ';
					}
				}
			}
			$text .= "\n";
		}

		return $text;
	}

	private static function unescape_pdf_string( $s ) {
		$map = [ '\\(' => '(', '\\)' => ')', '\\\\' => '\\', '\\n' => "\n", '\\r' => "\r", '\\t' => "\t" ];
		return strtr( $s, $map );
	}

	/* =========================================================
	   HTML -> EXCERPT
	========================================================= */

	/**
	 * Strip HTML and cap to a short excerpt. Never returns a full body —
	 * callers must not pass this the full source text and expect the
	 * cap alone to satisfy Hard Requirement 1; only ever feed it text
	 * already known to be excerpt-length (e.g. a meta description, an
	 * opening paragraph) — see extract_short_excerpt() for that guard.
	 *
	 * @param  string $html
	 * @param  int    $max_words
	 * @return string
	 */
	public static function strip_html_to_excerpt( $html, $max_words = self::MAX_EXCERPT_WORDS ) {
		$text = wp_strip_all_tags( (string) $html );
		$text = trim( preg_replace( '/\s+/', ' ', $text ) );
		return wp_trim_words( $text, $max_words, '…' );
	}

	/**
	 * Take arbitrary source text (email body, PDF text, monitored-page
	 * text) and return only a short excerpt — this is the one place
	 * every intake channel should route through before storing
	 * anything, so Hard Requirement 1 is enforced structurally rather
	 * than by convention at each call site.
	 *
	 * @param  string $text
	 * @param  int    $max_words
	 * @return string
	 */
	public static function extract_short_excerpt( $text, $max_words = self::MAX_EXCERPT_WORDS ) {
		$text = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $text ) ) );
		return wp_trim_words( $text, $max_words, '…' );
	}

	/**
	 * Return at most one short quote from source text — never the full
	 * text, never multiple quotes. Looks for the first double-quoted
	 * span; falls back to the first sentence, both capped in length.
	 *
	 * @param  string $text
	 * @return string
	 */
	public static function extract_one_short_quote( $text ) {
		$text = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $text ) ) );
		if ( '' === $text ) {
			return '';
		}

		if ( preg_match( '/[“"]([^“”"]{10,400})[”"]/u', $text, $m ) ) {
			return wp_trim_words( trim( $m[1] ), self::MAX_QUOTE_WORDS, '…' );
		}

		$sentences = preg_split( '/(?<=[.!?])\s+/', $text, 2 );
		return wp_trim_words( trim( $sentences[0] ?? '' ), self::MAX_QUOTE_WORDS, '…' );
	}

	/* =========================================================
	   ENTITY EXTRACTION (naive)
	   A lightweight heuristic only — matches capitalized word runs as
	   candidate horse/trainer/driver/track names. Phase 4's dedup/
	   trending layer cross-references these against the HarnessLink
	   archive; this phase only needs a reasonable first pass.
	========================================================= */

	/**
	 * @param  string $text
	 * @return string[] Deduplicated candidate entity names.
	 */
	public static function extract_entities_naive( $text ) {
		$text = wp_strip_all_tags( (string) $text );
		if ( ! preg_match_all( '/\b(?:[A-Z][a-zA-Z\'\-]+\s){1,3}[A-Z][a-zA-Z\'\-]+\b/', $text, $matches ) ) {
			return [];
		}

		$stopwords = [ 'The', 'A', 'An', 'This', 'That', 'It', 'He', 'She', 'They', 'In', 'On', 'At', 'For' ];
		$entities  = [];
		foreach ( $matches[0] as $candidate ) {
			$first_word = strtok( $candidate, ' ' );
			if ( in_array( $first_word, $stopwords, true ) ) {
				continue;
			}
			$entities[ $candidate ] = true;
		}

		return array_keys( $entities );
	}

	/* =========================================================
	   STEWARDS-REPORT DETECTION (shared heuristic)
	========================================================= */

	const STEWARDS_KEYWORDS = [ 'steward', 'stewards', 'ruling', 'suspension', 'suspended', 'inquiry', 'protest', 'penalty', 'penalties', 'disqualif' ];

	/**
	 * @param  string $text_or_filename
	 * @return bool
	 */
	public static function looks_like_stewards_report( $text_or_filename ) {
		$haystack = strtolower( (string) $text_or_filename );
		foreach ( self::STEWARDS_KEYWORDS as $keyword ) {
			if ( false !== strpos( $haystack, $keyword ) ) {
				return true;
			}
		}
		return false;
	}
}
