<?php
/**
 * HLN_Race_Calendar_Adapter_Interface + HLN_Generic_Calendar_Adapter —
 * the extensibility point for jurisdiction-specific feature-race-calendar
 * extraction.
 *
 * HLN_Race_Data resolves an adapter per source via the
 * 'hln_race_calendar_adapter_{slug}' filter, falling back to
 * HLN_Generic_Calendar_Adapter (a generic best-effort <table> reader)
 * when no jurisdiction-specific adapter is registered — which is every
 * source today. Real per-body markup isn't known yet, so this phase
 * deliberately does not ship jurisdiction adapters (an HRNSW adapter, an
 * HRNZ adapter, a USTA adapter, etc.) — only the architecture for adding
 * them later without changing HLN_Race_Data itself:
 *
 *   add_filter( 'hln_race_calendar_adapter_hrnsw', function ( $adapter, $entry ) {
 *       return new My_HRNSW_Calendar_Adapter(); // Implements the
 *                                                // interface below,
 *                                                // defined in your own
 *                                                // integration code.
 *   }, 10, 2 );
 */
if ( ! defined( 'ABSPATH' ) ) exit;

interface HLN_Race_Calendar_Adapter_Interface {
	/**
	 * @param  string $html         Raw HTML of the source's calendar/listing page.
	 * @param  array  $source_entry The matched HLN_Sources entry (with _slug/_type).
	 * @return array[] Each row: ['race_name','race_date' (Y-m-d|null),'grade','prize_money']
	 */
	public function extract( $html, array $source_entry );
}

/**
 * Generic best-effort reader: pulls rows from any <table> whose text
 * mentions race/date/grade/prize. Good enough as a starting point across
 * unknown markup, not a substitute for a real per-body adapter.
 */
class HLN_Generic_Calendar_Adapter implements HLN_Race_Calendar_Adapter_Interface {

	public function extract( $html, array $source_entry ) {
		if ( empty( $html ) ) {
			return [];
		}

		libxml_use_internal_errors( true );
		$doc = new DOMDocument();
		$doc->loadHTML( '<?xml encoding="UTF-8">' . $html );
		libxml_clear_errors();
		$xpath = new DOMXPath( $doc );

		$rows = [];
		foreach ( $xpath->query( '//table' ) as $table ) {
			$header_text = strtolower( trim( $table->textContent ) );
			if ( ! preg_match( '/race|date|grade|stake|prize/i', $header_text ) ) {
				continue;
			}
			foreach ( $xpath->query( './/tr', $table ) as $tr ) {
				$cells = [];
				foreach ( $xpath->query( './/td|.//th', $tr ) as $cell ) {
					$cells[] = trim( $cell->textContent );
				}
				if ( count( $cells ) < 2 ) {
					continue;
				}
				$rows[] = [
					'race_name'   => $cells[0] ?? '',
					'race_date'   => $this->find_date_in_cells( $cells ),
					'grade'       => $this->find_grade_in_cells( $cells ),
					'prize_money' => $this->find_prize_in_cells( $cells ),
				];
			}
		}

		return array_filter( $rows, fn( $r ) => '' !== $r['race_name'] );
	}

	private function find_date_in_cells( array $cells ) {
		foreach ( $cells as $cell ) {
			$ts = strtotime( $cell );
			if ( $ts && preg_match( '/\d{4}|\d{1,2}\/\d{1,2}/', $cell ) ) {
				return gmdate( 'Y-m-d', $ts );
			}
		}
		return null;
	}

	private function find_grade_in_cells( array $cells ) {
		foreach ( $cells as $cell ) {
			if ( preg_match( '/\b(grade|group|G[1-3])\b/i', $cell ) ) {
				return $cell;
			}
		}
		return '';
	}

	private function find_prize_in_cells( array $cells ) {
		foreach ( $cells as $cell ) {
			if ( preg_match( '/[$£€]\s?[\d,]+/', $cell, $m ) ) {
				return $m[0];
			}
		}
		return '';
	}
}
