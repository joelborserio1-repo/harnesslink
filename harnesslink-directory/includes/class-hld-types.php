<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * HLD_Types
 *
 * Central registry for HarnessLink Directory categories ("directory types").
 *
 * Every listing in the directory belongs to exactly one directory type
 * (stallion, trainer, driver, agistment, transport, …). Types are stored
 * in a single WordPress option so new categories can be added, renamed,
 * reordered, enabled or disabled from the admin without touching code.
 *
 * The plugin ships with a set of built-in defaults (the existing
 * stallion / trainer / driver categories plus the new industry
 * categories). Admins may edit any of them and add their own.
 */
class HLD_Types {

    const OPTION = 'hld_directory_types';

    /**
     * Built-in default categories. Used to seed the option on activation
     * and as a fallback if the stored option is ever lost or corrupted.
     *
     * Field reference:
     *  - singular / plural : display labels
     *  - name_label        : header for the primary "name" column
     *  - org_label         : header for the secondary "organisation" column
     *  - icon              : short glyph/initials shown in the category nav
     *  - description       : used on coming-soon empty states
     *  - tagline           : sub-heading shown under the directory title
     *  - supports_gait     : show the Pacer/Trotter gait column + filter
     *  - enabled           : show in the front-end category navigation
     *  - sort              : ordering within the navigation
     *  - builtin           : true for shipped types (cannot be deleted, only disabled)
     */
    public static function defaults() {
        return array(
            'stallion' => array(
                'singular'      => 'Stallion',
                'plural'        => 'Stallions',
                'name_label'    => 'Stallion',
                'org_label'     => 'Stud',
                'icon'          => 'ST',
                'tagline'       => 'Global / Australia, New Zealand &amp; beyond',
                'description'   => 'Browse stallions and studs by country, gait and service details.',
                'supports_gait' => true,
                'enabled'       => true,
                'sort'          => 10,
                'builtin'       => true,
            ),
            'trainer' => array(
                'singular'      => 'Trainer',
                'plural'        => 'Trainers',
                'name_label'    => 'Trainer',
                'org_label'     => 'Stable',
                'icon'          => 'TR',
                'tagline'       => 'Accredited trainers across every jurisdiction',
                'description'   => 'Find trainers by location, stable and current form.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 20,
                'builtin'       => true,
            ),
            'driver' => array(
                'singular'      => 'Driver',
                'plural'        => 'Drivers',
                'name_label'    => 'Driver',
                'org_label'     => 'Based At',
                'icon'          => 'DR',
                'tagline'       => 'Accredited reinspersons and booking contacts',
                'description'   => 'Browse accredited drivers by jurisdiction, current form and booking contacts.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 30,
                'builtin'       => true,
            ),
            'agistment' => array(
                'singular'      => 'Agistment',
                'plural'        => 'Agistment',
                'name_label'    => 'Property',
                'org_label'     => 'Operator',
                'icon'          => 'AG',
                'tagline'       => 'Spelling, agistment and paddock services',
                'description'   => 'Agistment properties offering spelling, paddocks and recovery facilities.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 40,
                'builtin'       => true,
            ),
            'transport' => array(
                'singular'      => 'Equine Transport',
                'plural'        => 'Equine Transport',
                'name_label'    => 'Business',
                'org_label'     => 'Service Area',
                'icon'          => 'TP',
                'tagline'       => 'Float and long-haul horse transport operators',
                'description'   => 'Equine transport operators for local floats and interstate haulage.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 50,
                'builtin'       => true,
            ),
            'vet' => array(
                'singular'      => 'Veterinary Service',
                'plural'        => 'Veterinary Services',
                'name_label'    => 'Practice',
                'org_label'     => 'Specialty',
                'icon'          => 'VS',
                'tagline'       => 'Equine veterinary practices and specialists',
                'description'   => 'Equine veterinary practices, surgeries and reproduction specialists.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 60,
                'builtin'       => true,
            ),
            'feed-supplements' => array(
                'singular'      => 'Feed &amp; Supplements',
                'plural'        => 'Feed &amp; Supplements',
                'name_label'    => 'Business',
                'org_label'     => 'Brand',
                'icon'          => 'FS',
                'tagline'       => 'Feed, nutrition and supplement suppliers',
                'description'   => 'Feed mills, nutritionists and supplement brands for performance horses.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 70,
                'builtin'       => true,
            ),
            'bloodstock' => array(
                'singular'      => 'Bloodstock Service',
                'plural'        => 'Bloodstock Services',
                'name_label'    => 'Agency',
                'org_label'     => 'Specialty',
                'icon'          => 'BS',
                'tagline'       => 'Bloodstock agents, sales and advisory services',
                'description'   => 'Bloodstock agents, sales reps and breeding advisory services.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 80,
                'builtin'       => true,
            ),
            'syndicator' => array(
                'singular'      => 'Syndicator',
                'plural'        => 'Syndicators &amp; Ownership Groups',
                'name_label'    => 'Group',
                'org_label'     => 'Manager',
                'icon'          => 'SY',
                'tagline'       => 'Syndicators and ownership groups',
                'description'   => 'Syndicators and ownership groups offering shares in racing and breeding stock.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 90,
                'builtin'       => true,
            ),
            'pre-training' => array(
                'singular'      => 'Breaking &amp; Pre-Training',
                'plural'        => 'Breaking &amp; Pre-Training',
                'name_label'    => 'Business',
                'org_label'     => 'Operator',
                'icon'          => 'PT',
                'tagline'       => 'Breaking-in and pre-training operations',
                'description'   => 'Breaking-in and pre-training operations preparing young horses for the track.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 100,
                'builtin'       => true,
            ),
            'industry-service' => array(
                'singular'      => 'Industry Service',
                'plural'        => 'Equine Businesses &amp; Industry Services',
                'name_label'    => 'Business',
                'org_label'     => 'Service',
                'icon'          => 'IS',
                'tagline'       => 'Equine businesses and industry services',
                'description'   => 'Equine businesses and industry service providers supporting the harness racing community.',
                'supports_gait' => false,
                'enabled'       => true,
                'sort'          => 110,
                'builtin'       => true,
            ),
        );
    }

    /**
     * Seed the option with defaults if it does not yet exist, and make sure
     * any newly-shipped built-in types are merged into an existing install.
     * Safe to call repeatedly (on activation / upgrade).
     */
    public static function seed() {
        $stored = get_option( self::OPTION, null );

        if ( ! is_array( $stored ) ) {
            update_option( self::OPTION, self::defaults() );
            return;
        }

        // Merge in any built-in types added in a later plugin version,
        // without overwriting admin customisations of existing ones.
        $changed = false;
        foreach ( self::defaults() as $slug => $def ) {
            if ( ! isset( $stored[ $slug ] ) ) {
                $stored[ $slug ] = $def;
                $changed = true;
            }
        }
        if ( $changed ) {
            update_option( self::OPTION, $stored );
        }
    }

    /** Normalise a stored/raw type array into a complete record. */
    private static function normalise( $slug, $data ) {
        $defaults = self::defaults();
        $base     = isset( $defaults[ $slug ] ) ? $defaults[ $slug ] : array();

        $record = wp_parse_args( (array) $data, wp_parse_args( $base, array(
            'singular'      => ucwords( str_replace( '-', ' ', $slug ) ),
            'plural'        => ucwords( str_replace( '-', ' ', $slug ) ),
            'name_label'    => 'Name',
            'org_label'     => 'Organisation',
            'icon'          => strtoupper( substr( preg_replace( '/[^a-z]/i', '', $slug ), 0, 2 ) ) ?: 'HL',
            'tagline'       => '',
            'description'   => '',
            'supports_gait' => false,
            'enabled'       => true,
            'sort'          => 500,
            'builtin'       => false,
        ) ) );

        $record['slug']          = $slug;
        $record['supports_gait'] = ! empty( $record['supports_gait'] );
        $record['enabled']       = ! empty( $record['enabled'] );
        $record['builtin']       = ! empty( $record['builtin'] ) || isset( $defaults[ $slug ] );
        $record['sort']          = (int) $record['sort'];

        return $record;
    }

    /** All registered types, keyed by slug, sorted by their sort order. */
    public static function get_all( $only_enabled = false ) {
        $stored = get_option( self::OPTION, null );
        if ( ! is_array( $stored ) || empty( $stored ) ) {
            $stored = self::defaults();
        }

        $types = array();
        foreach ( $stored as $slug => $data ) {
            $slug = self::sanitize_slug( $slug );
            if ( ! $slug ) continue;
            $record = self::normalise( $slug, $data );
            if ( $only_enabled && ! $record['enabled'] ) continue;
            $types[ $slug ] = $record;
        }

        uasort( $types, function ( $a, $b ) {
            if ( $a['sort'] === $b['sort'] ) {
                return strcasecmp( $a['plural'], $b['plural'] );
            }
            return $a['sort'] <=> $b['sort'];
        } );

        return $types;
    }

    /** A single type record, or null if the slug is unknown. */
    public static function get( $slug ) {
        $slug = self::sanitize_slug( $slug );
        if ( ! $slug ) return null;
        $all = self::get_all();
        return isset( $all[ $slug ] ) ? $all[ $slug ] : null;
    }

    public static function exists( $slug ) {
        return (bool) self::get( $slug );
    }

    /** The default type used when none is specified (back-compat: stallion). */
    public static function default_slug() {
        $all = self::get_all( true );
        if ( isset( $all['stallion'] ) ) return 'stallion';
        $first = array_key_first( $all );
        return $first ?: 'stallion';
    }

    /**
     * Resolve a requested type slug to a valid, enabled one. Falls back to
     * the default type when the request is empty or invalid.
     */
    public static function resolve( $slug ) {
        $slug = self::sanitize_slug( $slug );
        $all  = self::get_all();
        if ( $slug && isset( $all[ $slug ] ) ) {
            return $slug;
        }
        return self::default_slug();
    }

    /** Human label helper. */
    public static function label( $slug, $plural = true ) {
        $type = self::get( $slug );
        if ( ! $type ) return ucwords( str_replace( '-', ' ', (string) $slug ) );
        return $plural ? $type['plural'] : $type['singular'];
    }

    /** Create or update a type. Returns the sanitised slug or WP_Error. */
    public static function save( $slug, $data, $original_slug = '' ) {
        $slug = self::sanitize_slug( $slug );
        if ( ! $slug ) {
            return new WP_Error( 'hld_bad_slug', 'A valid slug (letters, numbers and dashes) is required.' );
        }

        $stored = get_option( self::OPTION, array() );
        if ( ! is_array( $stored ) ) $stored = array();

        $original_slug = self::sanitize_slug( $original_slug );
        $is_rename     = $original_slug && $original_slug !== $slug;

        // Prevent clobbering a different existing type on create/rename.
        if ( ( ! $original_slug || $is_rename ) && isset( $stored[ $slug ] ) ) {
            return new WP_Error( 'hld_dup_slug', 'A directory type with that slug already exists.' );
        }

        $existing = $original_slug && isset( $stored[ $original_slug ] ) ? $stored[ $original_slug ] : array();
        $builtin  = ! empty( $existing['builtin'] ) || isset( self::defaults()[ $slug ] );

        $record = array(
            'singular'      => sanitize_text_field( $data['singular'] ?? '' ) ?: ucwords( str_replace( '-', ' ', $slug ) ),
            'plural'        => sanitize_text_field( $data['plural'] ?? '' ) ?: ( sanitize_text_field( $data['singular'] ?? '' ) ?: ucwords( str_replace( '-', ' ', $slug ) ) ),
            'name_label'    => sanitize_text_field( $data['name_label'] ?? '' ) ?: 'Name',
            'org_label'     => sanitize_text_field( $data['org_label'] ?? '' ) ?: 'Organisation',
            'icon'          => sanitize_text_field( $data['icon'] ?? '' ) ?: strtoupper( substr( preg_replace( '/[^a-z]/i', '', $slug ), 0, 2 ) ),
            'tagline'       => sanitize_text_field( $data['tagline'] ?? '' ),
            'description'   => sanitize_textarea_field( $data['description'] ?? '' ),
            'supports_gait' => ! empty( $data['supports_gait'] ) ? 1 : 0,
            'enabled'       => ! empty( $data['enabled'] ) ? 1 : 0,
            'sort'          => isset( $data['sort'] ) ? (int) $data['sort'] : 500,
            'builtin'       => $builtin ? 1 : 0,
        );

        // Built-in types cannot be renamed (slug is referenced by listings).
        if ( $is_rename && ! empty( $existing['builtin'] ) ) {
            return new WP_Error( 'hld_builtin_rename', 'Built-in directory types cannot have their slug changed.' );
        }

        if ( $is_rename ) {
            unset( $stored[ $original_slug ] );
            // Re-point existing listings to the new slug.
            HLD_DB::rename_directory_type( $original_slug, $slug );
        }

        $stored[ $slug ] = $record;
        update_option( self::OPTION, $stored );

        return $slug;
    }

    /** Delete a custom type. Built-in types may only be disabled. */
    public static function delete( $slug ) {
        $slug   = self::sanitize_slug( $slug );
        $stored = get_option( self::OPTION, array() );
        if ( ! is_array( $stored ) || ! isset( $stored[ $slug ] ) ) {
            return new WP_Error( 'hld_missing', 'That directory type does not exist.' );
        }
        if ( isset( self::defaults()[ $slug ] ) || ! empty( $stored[ $slug ]['builtin'] ) ) {
            return new WP_Error( 'hld_builtin', 'Built-in directory types cannot be deleted — disable them instead.' );
        }
        unset( $stored[ $slug ] );
        update_option( self::OPTION, $stored );
        return true;
    }

    /* ──────────────────────────────────────────────
       FIELD SCHEMAS
       Each directory type captures its own set of fields. Stallions keep
       their full bespoke schema; every other type uses the streamlined
       "service" schema (Name + contact + location, plus optional coverage /
       industry fields). Drives the admin form, listing table and profile.
    ────────────────────────────────────────────── */

    /** Master map of toggleable fields: key => array( label, input type ). */
    public static function field_meta() {
        return array(
            'contact_phone'   => array( 'label' => 'Phone',    'type' => 'tel' ),
            'contact_email'   => array( 'label' => 'Email',    'type' => 'email' ),
            'contact_website' => array( 'label' => 'Website',  'type' => 'url' ),
            'suburb'          => array( 'label' => 'Suburb',   'type' => 'text' ),
            'region'          => array( 'label' => 'State',    'type' => 'text' ),
            'country'         => array( 'label' => 'Country',  'type' => 'text' ),
            'coverage'        => array( 'label' => 'Coverage', 'type' => 'textarea' ),
            'industry'        => array( 'label' => 'Industry Involvement', 'type' => 'text' ),
        );
    }

    /**
     * Per-type field definitions. Returns array of:
     *   array( 'fields' => array( key => labelOverride|null ), 'note' => '' )
     * Anything not listed here (custom types) falls back to the generic set.
     */
    private static function schema_map() {
        $contact     = array( 'contact_phone' => null, 'contact_email' => null );
        $location    = array( 'suburb' => null, 'region' => null, 'country' => null );
        $with_site   = array( 'contact_website' => null );

        return array(
            'trainer'      => $contact + $location,
            'driver'       => $contact + $location,
            'pre-training' => $contact + $location,
            'syndicator'   => $contact + $with_site + $location,
            'bloodstock'   => $contact + $with_site + $location,
            'agistment'    => $contact + $with_site + $location,
            'transport'    => $contact + $with_site + $location + array( 'coverage' => 'Routes Travelled' ),
            'vet'          => $contact + $with_site + $location + array( 'coverage' => 'Locations Covered' ),
            'feed-supplements' => $contact + $with_site + $location + array( 'coverage' => 'Delivery Locations' ),
            'industry-service' => array( 'industry' => 'Industry Involvement' ) + $contact + $location + array( 'coverage' => 'Delivery Locations' ),
        );
    }

    /** Layout for a type: 'stallion' (rich) or 'service' (streamlined). */
    public static function layout( $slug ) {
        $type = self::get( $slug );
        return ( $type && ! empty( $type['supports_gait'] ) ) ? 'stallion' : 'service';
    }

    /**
     * Ordered list of editable fields for a type's "service" form:
     * array of array( 'key', 'label', 'type' ). Empty for stallion layout
     * (stallions use their dedicated bespoke form).
     */
    public static function fields( $slug ) {
        $slug = self::sanitize_slug( $slug );
        if ( self::layout( $slug ) === 'stallion' ) {
            return array();
        }

        $meta = self::field_meta();
        $map  = self::schema_map();

        // Generic fallback for custom types: contact + website + location.
        $set = isset( $map[ $slug ] ) ? $map[ $slug ] : array(
            'contact_phone' => null, 'contact_email' => null,
            'contact_website' => null, 'suburb' => null,
            'region' => null, 'country' => null,
        );

        $out = array();
        foreach ( $set as $key => $label_override ) {
            if ( ! isset( $meta[ $key ] ) ) continue;
            $out[] = array(
                'key'   => $key,
                'label' => $label_override ?: $meta[ $key ]['label'],
                'type'  => $meta[ $key ]['type'],
            );
        }
        return $out;
    }

    /**
     * Config consumed by the admin JS to adapt the add/edit modal per type:
     * { slug: { layout, gait, fields:[keys], labels:{key:label} } }
     */
    public static function js_config() {
        $cfg = array();
        foreach ( self::get_all() as $slug => $t ) {
            $layout = self::layout( $slug );
            $entry  = array(
                'layout' => $layout,
                'gait'   => ! empty( $t['supports_gait'] ),
                'fields' => array(),
                'labels' => array(),
            );
            foreach ( self::fields( $slug ) as $f ) {
                $entry['fields'][] = $f['key'];
                $entry['labels'][ $f['key'] ] = $f['label'];
            }
            $cfg[ $slug ] = $entry;
        }
        return $cfg;
    }

    public static function sanitize_slug( $slug ) {
        $slug = strtolower( trim( (string) $slug ) );
        $slug = preg_replace( '/[^a-z0-9\-]+/', '-', $slug );
        $slug = preg_replace( '/-+/', '-', $slug );
        return trim( $slug, '-' );
    }

    /* ──────────────────────────────────────────────
       ICONOGRAPHY
       Monochrome inline-SVG icons per category. They inherit colour via
       `currentColor`, so they work on both the light chips and the active
       navy chip. Unknown/custom types return '' (callers fall back to the
       type's text initials).
    ────────────────────────────────────────────── */
    public static function icon_svg( $slug ) {
        $slug  = self::sanitize_slug( $slug );
        $paths = self::icon_paths();
        if ( ! isset( $paths[ $slug ] ) ) {
            return '';
        }
        return '<svg class="hld-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
             . 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '
             . 'aria-hidden="true" focusable="false">' . $paths[ $slug ] . '</svg>';
    }

    private static function icon_paths() {
        return array(
            // Horseshoe
            'stallion' => '<path d="M6.5 21c-2-1.4-3.5-3.8-3.5-7a9 9 0 0 1 18 0c0 3.2-1.5 5.6-3.5 7"/><path d="M6.5 21l1-2.3"/><path d="M17.5 21l-1-2.3"/>',
            // Clipboard list
            'trainer' => '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
            // Racing flag
            'driver' => '<path d="M5 21V4"/><path d="M5 4c2-1.5 4 1 7 0s5-1.5 7 0v9c-2 1.5-5-1-7 0s-5-1.5-7 0"/>',
            // Barn / property
            'agistment' => '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
            // Truck
            'transport' => '<path d="M2 7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10H2z"/><path d="M14 9h3.5l3.5 3.5V17h-3"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M8 18h7"/>',
            // Medical shield (vet)
            'vet' => '<path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="M12 9v6"/><path d="M9 12h6"/>',
            // Sprout (feed & supplements)
            'feed-supplements' => '<path d="M12 21v-7"/><path d="M12 14c0-3 2-5 5-5 0 3-2 5-5 5Z"/><path d="M12 14c0-3-2-5-5-5 0 3 2 5 5 5Z"/>',
            // Price tag (bloodstock)
            'bloodstock' => '<path d="M11 3H5a2 2 0 0 0-2 2v6l9 9 8-8-9-9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
            // Users group (syndicators)
            'syndicator' => '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.85"/><path d="M15.5 4.1a3.5 3.5 0 0 1 0 6.8"/>',
            // Graduation cap (breaking / pre-training)
            'pre-training' => '<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 11.5V16c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-4.5"/><path d="M21 9.5V14"/>',
            // Briefcase (industry services)
            'industry-service' => '<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 13h18"/>',
        );
    }
}
