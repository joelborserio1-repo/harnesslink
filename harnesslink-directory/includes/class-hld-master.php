<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * HLD_Master
 *
 * Safe, preview-first synchronisation of the stallion directory against a
 * "master" CSV export (the wide, one-row-per-stallion layout with up to six
 * Country/Stud pairs).
 *
 * Rules (fixed by product decision):
 *   - PAYING or FEATURED stallions are never updated or deleted (protected).
 *   - Existing free listings present in the sheet are updated.
 *   - Stallions in the sheet not already present are created as free listings.
 *   - Existing FREE listings absent from the sheet are deleted (full sync).
 *   - Duplicate rows for the same stallion (standing in several locations) are
 *     merged into one listing carrying all its Country/Stud pairs.
 *
 * Every run defaults to a DRY RUN that changes nothing and returns a full
 * report; only an explicit apply performs writes.
 */
class HLD_Master {

    /** Country column layout in the master sheet: label => region code. */
    private static function country_codes() {
        return array(
            'australia'    => 'AUS',
            'new zealand'  => 'NZ',
            'usa'          => 'USA',
            'united states'=> 'USA',
            'canada'       => 'CA',
            'france'       => 'FRA',
            'sweden'       => 'SWE',
        );
    }

    /**
     * Parse an uploaded master CSV (wide format) into merged stallion records.
     * Expected header (case/spacing-flexible):
     *   Stallion, Gait, Country 1 (AUS), Stud, Country 2 (NZ), Stud, …
     *
     * Returns array(
     *   'rows'     => array of array( name, gait, countries[], studs[], country_str, stud_str ),
     *   'warnings' => array of human-readable anomaly strings,
     *   'errors'   => int rows skipped (no name),
     * )
     */
    public static function parse_csv( $file ) {
        $handle = fopen( $file, 'r' );
        if ( ! $handle ) {
            return new WP_Error( 'hld_master_read', 'Could not read the uploaded file.' );
        }

        $header = fgetcsv( $handle );
        if ( empty( $header ) ) {
            fclose( $handle );
            return new WP_Error( 'hld_master_header', 'The CSV header row is missing.' );
        }

        // Identify column roles from the header. We walk columns left→right:
        // the "stallion" and "gait" columns, then repeating (country, stud).
        $roles = array(); // index => 'name' | 'gait' | array('country', label) | 'stud'
        $last_country_label = '';
        foreach ( $header as $i => $raw ) {
            $h = strtolower( trim( preg_replace( '/^\xEF\xBB\xBF/', '', (string) $raw ) ) );
            if ( $h === 'stallion' || $h === 'name' ) {
                $roles[ $i ] = 'name';
            } elseif ( $h === 'gait' || $h === 'type' ) {
                $roles[ $i ] = 'gait';
            } elseif ( strpos( $h, 'country' ) === 0 ) {
                // e.g. "country 1 (aus)" → capture the label in brackets if present
                if ( preg_match( '/\(([^)]+)\)/', $h, $m ) ) {
                    $last_country_label = trim( $m[1] );
                } else {
                    $last_country_label = '';
                }
                $roles[ $i ] = array( 'country', $last_country_label );
            } elseif ( $h === 'stud' || strpos( $h, 'stud' ) === 0 ) {
                $roles[ $i ] = 'stud';
            } else {
                $roles[ $i ] = 'skip';
            }
        }

        $merged   = array();   // name_key => record
        $warnings = array();
        $errors   = 0;

        while ( ( $data = fgetcsv( $handle ) ) !== false ) {
            if ( ! array_filter( $data, 'strlen' ) ) continue;

            $name = ''; $gait = ''; $pairs = array(); $orphan_studs = array();
            $pending_country = null;

            foreach ( $roles as $i => $role ) {
                $val = isset( $data[ $i ] ) ? trim( self::fix_encoding( $data[ $i ] ) ) : '';
                if ( $role === 'name' ) {
                    $name = $val;
                } elseif ( $role === 'gait' ) {
                    $gait = $val;
                } elseif ( is_array( $role ) && $role[0] === 'country' ) {
                    // Flush any pending country that never got a stud.
                    if ( $pending_country !== null && $pending_country !== '' ) {
                        $pairs[] = array( 'country' => $pending_country, 'stud' => '' );
                    }
                    $pending_country = $val; // may be '' (no country in this slot)
                } elseif ( $role === 'stud' ) {
                    if ( $pending_country !== null && $pending_country !== '' ) {
                        $pairs[] = array( 'country' => $pending_country, 'stud' => $val );
                        $pending_country = null;
                    } elseif ( $val !== '' ) {
                        // Stud with no country in its own slot — anomaly.
                        $orphan_studs[] = $val;
                        $pending_country = null;
                    } else {
                        $pending_country = null;
                    }
                }
            }
            if ( $pending_country !== null && $pending_country !== '' ) {
                $pairs[] = array( 'country' => $pending_country, 'stud' => '' );
            }

            if ( $name === '' ) { $errors++; continue; }

            $key = self::name_key( $name );

            if ( ! isset( $merged[ $key ] ) ) {
                $merged[ $key ] = array(
                    'name'    => $name,
                    'gait'    => self::norm_gait( $gait ),
                    'pairs'   => array(),
                    'orphans' => array(),
                );
            }
            // Merge pairs (dedupe by country+stud).
            foreach ( $pairs as $p ) {
                $sig = strtolower( $p['country'] . '|' . $p['stud'] );
                $merged[ $key ]['_seen'][ $sig ] = true;
                $merged[ $key ]['pairs'][ $sig ] = $p;
            }
            foreach ( $orphan_studs as $o ) {
                $merged[ $key ]['orphans'][] = $o;
                $warnings[] = sprintf( '“%s”: stud “%s” has no country in its column — left unassigned. Check the sheet.', $name, $o );
            }
            if ( ! $merged[ $key ]['gait'] && $gait ) {
                $merged[ $key ]['gait'] = self::norm_gait( $gait );
            }
        }
        fclose( $handle );

        // Finalise records.
        $rows = array();
        foreach ( $merged as $key => $rec ) {
            $pairs = array_values( $rec['pairs'] );
            $countries = array();
            $studmap   = array(); // stud => array of codes
            $regional  = array(); // code => stud
            foreach ( $pairs as $p ) {
                $label = $p['country'];
                if ( $label === '' ) continue;
                $countries[ $label ] = true;
                $code = self::code_for( $label );
                if ( $p['stud'] !== '' ) {
                    $studmap[ $p['stud'] ][] = $code;
                    if ( ! isset( $regional[ $code ] ) ) $regional[ $code ] = $p['stud'];
                }
            }
            $country_str = implode( ' / ', array_keys( $countries ) );
            $stud_bits = array();
            foreach ( $studmap as $stud => $codes ) {
                $stud_bits[] = $stud . ' (' . implode( '/', array_unique( $codes ) ) . ')';
            }
            $stud_str = implode( ' | ', $stud_bits );

            $rows[] = array(
                'name'        => $rec['name'],
                'name_key'    => $key,
                'gait'        => $rec['gait'] ?: 'Pacer',
                'country_str' => $country_str,
                'stud_str'    => $stud_str,
                'regional'    => $regional,           // AUS/NZ/USA/CA/FRA/SWE => stud
                'primary_stud'=> $stud_bits ? reset( $stud_bits ) : '',
            );
        }

        // Stable alphabetical order.
        usort( $rows, function ( $a, $b ) { return strcasecmp( $a['name'], $b['name'] ); } );

        return array(
            'rows'     => $rows,
            'warnings' => array_values( array_unique( $warnings ) ),
            'errors'   => $errors,
        );
    }

    /**
     * Compare parsed rows against the live directory and return a plan.
     * When $apply is false nothing is written.
     */
    public static function sync( $rows, $apply = false ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';

        // Load existing stallions (this directory type only).
        $existing = $wpdb->get_results(
            "SELECT id, name, is_paying, is_featured FROM {$table} WHERE directory_type = 'stallion'"
        );
        $by_key = array();
        foreach ( $existing as $e ) {
            $by_key[ self::name_key( $e->name ) ] = $e;
        }

        $sheet_keys = array();
        $plan = array(
            'add'     => array(),
            'update'  => array(),
            'skip'    => array(),   // protected paying/featured
            'delete'  => array(),
        );

        foreach ( $rows as $r ) {
            $key = $r['name_key'];
            $sheet_keys[ $key ] = true;

            if ( isset( $by_key[ $key ] ) ) {
                $e = $by_key[ $key ];
                if ( $e->is_paying || $e->is_featured ) {
                    $plan['skip'][] = $r['name'];
                    continue;
                }
                $plan['update'][] = $r['name'];
                if ( $apply ) {
                    $wpdb->update( $table, self::to_columns( $r ), array( 'id' => (int) $e->id ) );
                }
            } else {
                $plan['add'][] = $r['name'];
                if ( $apply ) {
                    $wpdb->insert( $table, self::to_columns( $r, true ) );
                }
            }
        }

        // Deletions: existing FREE listings not present in the sheet.
        foreach ( $existing as $e ) {
            $key = self::name_key( $e->name );
            if ( isset( $sheet_keys[ $key ] ) ) continue;
            if ( $e->is_paying || $e->is_featured ) continue; // protected
            $plan['delete'][] = $e->name;
            if ( $apply ) {
                HLD_DB::delete_gallery_for_stallion( (int) $e->id );
                if ( method_exists( 'HLD_DB', 'delete_progeny' ) ) {
                    HLD_DB::delete_progeny( (int) $e->id );
                }
                $wpdb->delete( $table, array( 'id' => (int) $e->id ) );
            }
        }

        return array(
            'applied'      => (bool) $apply,
            'add'          => $plan['add'],
            'update'       => $plan['update'],
            'skip'         => $plan['skip'],
            'delete'       => $plan['delete'],
            'counts'       => array(
                'add'    => count( $plan['add'] ),
                'update' => count( $plan['update'] ),
                'skip'   => count( $plan['skip'] ),
                'delete' => count( $plan['delete'] ),
                'sheet'  => count( $rows ),
                'existing' => count( $existing ),
            ),
        );
    }

    /** Map a parsed row to hld_stallions columns. */
    private static function to_columns( $r, $is_new = false ) {
        $reg = $r['regional'];
        $cols = array(
            'name'          => $r['name'],
            'type'          => in_array( $r['gait'], array( 'Pacer', 'Trotter' ), true ) ? $r['gait'] : 'Pacer',
            'country'       => $r['country_str'],
            'stud_name'     => self::primary_stud_name( $r ),
            'contact_au'    => isset( $reg['AUS'] ) ? $reg['AUS'] : '',
            'contact_nz'    => isset( $reg['NZ'] )  ? $reg['NZ']  : '',
            'contact_us'    => isset( $reg['USA'] ) ? $reg['USA'] : '',
            'contact_fr'    => isset( $reg['FRA'] ) ? $reg['FRA'] : '',
            'contact_other' => self::other_studs( $reg ),
        );
        if ( $is_new ) {
            $cols['directory_type'] = 'stallion';
            $cols['is_paying']      = 0;
            $cols['is_featured']    = 0;
        }
        return $cols;
    }

    private static function primary_stud_name( $r ) {
        $reg = $r['regional'];
        foreach ( array( 'AUS', 'NZ', 'USA', 'CA', 'FRA', 'SWE' ) as $code ) {
            if ( ! empty( $reg[ $code ] ) ) return $reg[ $code ];
        }
        return '';
    }

    private static function other_studs( $reg ) {
        $bits = array();
        if ( ! empty( $reg['CA'] ) )  $bits[] = 'Canada: ' . $reg['CA'];
        if ( ! empty( $reg['SWE'] ) ) $bits[] = 'Sweden: ' . $reg['SWE'];
        return implode( "\n", $bits );
    }

    /* ── helpers ── */

    public static function name_key( $name ) {
        $k = strtolower( trim( (string) $name ) );
        $k = str_replace( array( "'", '’', '`' ), '', $k );
        $k = preg_replace( '/\s+/', ' ', $k );
        return $k;
    }

    private static function norm_gait( $g ) {
        $g = strtolower( trim( (string) $g ) );
        if ( strpos( $g, 'trot' ) !== false ) return 'Trotter';
        if ( strpos( $g, 'pac' )  !== false ) return 'Pacer';
        return '';
    }

    private static function code_for( $label ) {
        $codes = self::country_codes();
        $l = strtolower( trim( $label ) );
        return isset( $codes[ $l ] ) ? $codes[ $l ] : strtoupper( substr( $l, 0, 3 ) );
    }

    /** Repair common Excel mojibake (e.g. JÃ¤gersro → Jägersro). */
    private static function fix_encoding( $s ) {
        $s = (string) $s;
        if ( $s === '' ) return $s;
        // If it looks like UTF-8 mis-decoded as Latin-1, re-decode.
        if ( preg_match( '/Ã.|Â./', $s ) ) {
            $fixed = @mb_convert_encoding( $s, 'ISO-8859-1', 'UTF-8' );
            $back  = @mb_convert_encoding( $fixed, 'UTF-8', 'ISO-8859-1' );
            // Prefer the version that round-trips cleanly.
            if ( $fixed && mb_check_encoding( $fixed, 'UTF-8' ) ) {
                return $fixed;
            }
        }
        return $s;
    }
}
