<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_DB {

    public static function install() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        /* ── Stallions table ── */
        $sql_stallions = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}hld_stallions (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            directory_type  VARCHAR(50)     NOT NULL DEFAULT 'stallion',
            name            VARCHAR(200)    NOT NULL,
            stud_name       VARCHAR(200)    NOT NULL DEFAULT '',
            country         VARCHAR(100)    NOT NULL DEFAULT '',
            region          VARCHAR(100)    NOT NULL DEFAULT '',
            stud_master     VARCHAR(200)    NOT NULL DEFAULT '',
            suburb          VARCHAR(120)    NOT NULL DEFAULT '',
            industry        VARCHAR(200)    NOT NULL DEFAULT '',
            coverage        TEXT,
            type            ENUM('Pacer','Trotter') NOT NULL DEFAULT 'Pacer',
            status_note     VARCHAR(255)    NOT NULL DEFAULT '',
            is_paying       TINYINT(1)      NOT NULL DEFAULT 0,
            is_featured     TINYINT(1)      NOT NULL DEFAULT 0,
            contact_phone   VARCHAR(60)     NOT NULL DEFAULT '',
            contact_email   VARCHAR(120)    NOT NULL DEFAULT '',
            contact_website VARCHAR(255)    NOT NULL DEFAULT '',
            stud_website    VARCHAR(255)    NOT NULL DEFAULT '',
            contact_address TEXT            NOT NULL DEFAULT '',
            contact_au      TEXT,
            contact_us      TEXT,
            contact_nz      TEXT,
            contact_fr      TEXT,
            contact_other   TEXT,
            profile_bio     LONGTEXT,
            profile_image   VARCHAR(255)    NOT NULL DEFAULT '',
            race_record     VARCHAR(255)    NOT NULL DEFAULT '',
            service_fee     VARCHAR(100)    NOT NULL DEFAULT '',
            progeny_note    TEXT,
            created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_directory_type (directory_type),
            KEY idx_country (country),
            KEY idx_type (type),
            KEY idx_is_paying (is_paying),
            KEY idx_is_featured (is_featured)
        ) {$charset};";

        /* ── Enquiries table ── */
        $sql_enquiries = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}hld_enquiries (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            listing_type    VARCHAR(50)     NOT NULL DEFAULT 'Stallion',
            contact_name    VARCHAR(200)    NOT NULL DEFAULT '',
            contact_email   VARCHAR(120)    NOT NULL DEFAULT '',
            contact_phone   VARCHAR(60)     NOT NULL DEFAULT '',
            stud_name       VARCHAR(200)    NOT NULL DEFAULT '',
            country         VARCHAR(100)    NOT NULL DEFAULT '',
            region          VARCHAR(100)    NOT NULL DEFAULT '',
            message         TEXT,
            status          ENUM('new','contacted','converted','dismissed') NOT NULL DEFAULT 'new',
            admin_notes     TEXT,
            submitted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_status (status),
            KEY idx_listing_type (listing_type)
        ) {$charset};";

        /* ── Gallery table ── */
        $sql_gallery = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}hld_gallery (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            stallion_id  BIGINT UNSIGNED NOT NULL,
            media_type   ENUM('image','video') NOT NULL DEFAULT 'image',
            url          VARCHAR(1000)   NOT NULL DEFAULT '',
            attachment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            caption      VARCHAR(500)    NOT NULL DEFAULT '',
            sort_order   INT             NOT NULL DEFAULT 0,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_stallion (stallion_id),
            KEY idx_sort (stallion_id, sort_order)
        ) {$charset};";

        /* ── Progeny table ── */
        $sql_progeny = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}hld_progeny (
            id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            stallion_id    BIGINT UNSIGNED NOT NULL,
            name           VARCHAR(200)    NOT NULL DEFAULT '',
            foaling_date   VARCHAR(40)     NOT NULL DEFAULT '',
            country        VARCHAR(20)     NOT NULL DEFAULT '',
            sex            VARCHAR(20)     NOT NULL DEFAULT '',
            dam            VARCHAR(200)    NOT NULL DEFAULT '',
            broodmare_sire VARCHAR(200)    NOT NULL DEFAULT '',
            prizemoney     VARCHAR(60)     NOT NULL DEFAULT '',
            prizemoney_num BIGINT          NOT NULL DEFAULT 0,
            mile_rate      VARCHAR(40)     NOT NULL DEFAULT '',
            starts         INT             NOT NULL DEFAULT 0,
            wins           INT             NOT NULL DEFAULT 0,
            sort_order     INT             NOT NULL DEFAULT 0,
            created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_stallion (stallion_id),
            KEY idx_money (stallion_id, prizemoney_num)
        ) {$charset};";

        /* ── Crosses of Gold (repeatable breeding-cross entries) ── */
        $sql_crosses = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}hld_crosses (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            stallion_id  BIGINT UNSIGNED NOT NULL,
            title        VARCHAR(200)    NOT NULL DEFAULT '',
            description  TEXT,
            examples     TEXT,
            sort_order   INT             NOT NULL DEFAULT 0,
            created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_stallion (stallion_id),
            KEY idx_sort (stallion_id, sort_order)
        ) {$charset};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql_stallions );
        dbDelta( $sql_enquiries );
        dbDelta( $sql_gallery );
        dbDelta( $sql_progeny );
        dbDelta( $sql_crosses );
        self::ensure_columns();
        self::dedupe_stallions();

        add_option( 'hld_db_version', HLD_VERSION );
    }

    public static function maybe_upgrade() {
        if ( get_option( 'hld_db_version' ) !== HLD_VERSION ) {
            self::install();
            update_option( 'hld_db_version', HLD_VERSION );
            // New rewrite rules (e.g. /directory/{type}/) need a one-time flush.
            update_option( 'hld_needs_flush', '1' );
        } else {
            self::ensure_columns();
            self::dedupe_stallions();
        }

        // One-time repair of names/fields corrupted by historic over-escaping
        // (e.g. "Bettor\'s Delight"). Runs once per fix version.
        if ( get_option( 'hld_slash_fix' ) !== '2' ) {
            self::repair_escaped_slashes();
            update_option( 'hld_slash_fix', '2' );
        }

        // One-time seed of bundled progeny sheets (Bettors Delight + Colt
        // Thirty One, Southern Hemisphere set). Bumped to '2' to re-run after
        // the SH data update; only fills stallions that have no progeny yet.
        if ( get_option( 'hld_progeny_seed' ) !== '2' ) {
            self::seed_progeny_data();
            update_option( 'hld_progeny_seed', '2' );
        }
    }

    /**
     * Strip stray backslashes that accumulated in text columns from the
     * pre-1.3.2 save path (which stored slash-escaped $_POST data). Collapses
     * runs of backslashes before an apostrophe/quote, and removes a lone
     * backslash directly before ' or ".
     */
    public static function repair_escaped_slashes() {
        global $wpdb;
        $table   = $wpdb->prefix . 'hld_stallions';
        $columns = array(
            'name', 'stud_name', 'stud_master', 'status_note', 'region',
            'country', 'suburb', 'industry', 'profile_bio', 'progeny_note',
            'contact_address', 'coverage',
        );

        // Only touch rows that actually contain a backslash, for efficiency.
        $like = '%' . $wpdb->esc_like( '\\' ) . '%';
        $or   = array();
        foreach ( $columns as $c ) {
            $or[] = "{$c} LIKE %s";
        }
        $sql  = "SELECT * FROM {$table} WHERE " . implode( ' OR ', $or );
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, array_fill( 0, count( $columns ), $like ) ) );

        if ( empty( $rows ) ) return;

        foreach ( $rows as $row ) {
            $update = array();
            foreach ( $columns as $c ) {
                if ( ! isset( $row->$c ) || $row->$c === '' ) continue;
                $clean = self::strip_stray_slashes( $row->$c );
                if ( $clean !== $row->$c ) {
                    $update[ $c ] = $clean;
                }
            }
            if ( $update ) {
                $wpdb->update( $table, $update, array( 'id' => (int) $row->id ) );
            }
        }
    }

    /** Remove backslashes used only to escape quotes/apostrophes. */
    private static function strip_stray_slashes( $value ) {
        // Collapse one or more backslashes immediately before ' " or \ .
        return preg_replace( '/\\\\+([\'"\\\\])/', '$1', (string) $value );
    }

    public static function ensure_columns() {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';
        $columns = $wpdb->get_col( "DESC {$table}", 0 );

        if ( empty( $columns ) ) return;

        $missing = array(
            'directory_type' => "ALTER TABLE {$table} ADD directory_type VARCHAR(50) NOT NULL DEFAULT 'stallion'",
            'suburb'        => "ALTER TABLE {$table} ADD suburb VARCHAR(120) NOT NULL DEFAULT ''",
            'industry'      => "ALTER TABLE {$table} ADD industry VARCHAR(200) NOT NULL DEFAULT ''",
            'coverage'      => "ALTER TABLE {$table} ADD coverage TEXT",
            'contact_au'    => "ALTER TABLE {$table} ADD contact_au TEXT",
            'contact_us'    => "ALTER TABLE {$table} ADD contact_us TEXT",
            'contact_nz'    => "ALTER TABLE {$table} ADD contact_nz TEXT",
            'contact_fr'    => "ALTER TABLE {$table} ADD contact_fr TEXT",
            'contact_other' => "ALTER TABLE {$table} ADD contact_other TEXT",
            'stud_website'  => "ALTER TABLE {$table} ADD stud_website VARCHAR(255) NOT NULL DEFAULT ''",
            'is_featured'   => "ALTER TABLE {$table} ADD is_featured TINYINT(1) NOT NULL DEFAULT 0",

            /* ── Profile / hero / summary ── */
            'tagline'        => "ALTER TABLE {$table} ADD tagline VARCHAR(255) NOT NULL DEFAULT ''",
            'short_summary'  => "ALTER TABLE {$table} ADD short_summary TEXT",
            'year_of_birth'  => "ALTER TABLE {$table} ADD year_of_birth VARCHAR(10) NOT NULL DEFAULT ''",
            'colour'         => "ALTER TABLE {$table} ADD colour VARCHAR(60) NOT NULL DEFAULT ''",
            'sex'            => "ALTER TABLE {$table} ADD sex VARCHAR(30) NOT NULL DEFAULT ''",
            'booking_url'    => "ALTER TABLE {$table} ADD booking_url VARCHAR(255) NOT NULL DEFAULT ''",
            'booking_label'  => "ALTER TABLE {$table} ADD booking_label VARCHAR(100) NOT NULL DEFAULT ''",
            'hero_image_id'  => "ALTER TABLE {$table} ADD hero_image_id BIGINT UNSIGNED NOT NULL DEFAULT 0",
            'career_earnings' => "ALTER TABLE {$table} ADD career_earnings VARCHAR(100) NOT NULL DEFAULT ''",

            /* ── Crosses of Gold intro + related horses ── */
            'crosses_intro' => "ALTER TABLE {$table} ADD crosses_intro TEXT",
            'related_ids'   => "ALTER TABLE {$table} ADD related_ids TEXT",

            /* ── Pedigree: parents, grandparents, great-grandparents ── */
            'ped_sire' => "ALTER TABLE {$table} ADD ped_sire VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_dam'  => "ALTER TABLE {$table} ADD ped_dam VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_ss'   => "ALTER TABLE {$table} ADD ped_ss VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_sd'   => "ALTER TABLE {$table} ADD ped_sd VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_ds'   => "ALTER TABLE {$table} ADD ped_ds VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_dd'   => "ALTER TABLE {$table} ADD ped_dd VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_sss'  => "ALTER TABLE {$table} ADD ped_sss VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_ssd'  => "ALTER TABLE {$table} ADD ped_ssd VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_sds'  => "ALTER TABLE {$table} ADD ped_sds VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_sdd'  => "ALTER TABLE {$table} ADD ped_sdd VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_dss'  => "ALTER TABLE {$table} ADD ped_dss VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_dsd'  => "ALTER TABLE {$table} ADD ped_dsd VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_dds'  => "ALTER TABLE {$table} ADD ped_dds VARCHAR(200) NOT NULL DEFAULT ''",
            'ped_ddd'  => "ALTER TABLE {$table} ADD ped_ddd VARCHAR(200) NOT NULL DEFAULT ''",
        );

        foreach ( $missing as $column => $sql ) {
            if ( ! in_array( $column, $columns, true ) ) {
                $wpdb->query( $sql );
            }
        }

        /* Gallery table: video description (caption doubles as the video title). */
        $gallery_table   = $wpdb->prefix . 'hld_gallery';
        $gallery_columns = $wpdb->get_col( "DESC {$gallery_table}", 0 );
        if ( ! empty( $gallery_columns ) && ! in_array( 'description', $gallery_columns, true ) ) {
            $wpdb->query( "ALTER TABLE {$gallery_table} ADD description TEXT" );
        }
    }

    public static function has_column( $column ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';
        $columns = $wpdb->get_col( "DESC {$table}", 0 );
        return in_array( $column, (array) $columns, true );
    }

    public static function dedupe_stallions() {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';

        // Dedupe within each directory type — a stallion and a trainer that
        // happen to share a name are NOT duplicates of each other.
        $groups = $wpdb->get_results(
            "SELECT directory_type AS dtype, LOWER(TRIM(name)) AS name_key, COUNT(*) AS row_count
             FROM {$table}
             WHERE name != ''
             GROUP BY directory_type, LOWER(TRIM(name))
             HAVING row_count > 1"
        );

        foreach ( $groups as $group ) {
            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT id FROM {$table}
                 WHERE directory_type = %s AND LOWER(TRIM(name)) = %s
                 ORDER BY is_featured DESC, is_paying DESC, id ASC",
                $group->dtype,
                $group->name_key
            ) );

            if ( empty( $rows ) ) continue;

            foreach ( array_slice( $rows, 1 ) as $row ) {
                $duplicate_id = absint( $row->id );
                self::delete_gallery_for_stallion( $duplicate_id );
                $wpdb->delete( $table, array( 'id' => $duplicate_id ) );
            }
        }
    }

    public static function deactivate() {
        // intentionally leave data intact on deactivate
    }

    /* ── Query helpers ── */

    /**
     * Back-compat wrapper: stallion-only listings.
     * Existing callers keep working unchanged.
     */
    public static function get_stallions( $args = array() ) {
        $args['directory_type'] = 'stallion';
        return self::get_listings( $args );
    }

    /**
     * Generic, type-aware listing query. Pass 'directory_type' to scope to a
     * single directory category; omit it to query across all types.
     */
    public static function get_listings( $args = array() ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';

        $defaults = array(
            'directory_type' => '',
            'search'  => '',
            'country' => '',
            'type'    => '',
            'region'  => '',
            'letter'  => '',
            'page'    => 1,
            'per_page'=> 20,
            'orderby' => 'name',
            'order'   => 'ASC',
        );
        $a = wp_parse_args( $args, $defaults );

        // Clamp per_page to the allowed view sizes (guards the SQL LIMIT).
        $a['per_page'] = self::clamp_per_page( $a['per_page'] );

        $where  = array( '1=1' );
        $params = array();

        if ( $a['directory_type'] !== '' && self::has_column( 'directory_type' ) ) {
            $where[]  = 'directory_type = %s';
            $params[] = HLD_Types::sanitize_slug( $a['directory_type'] );
        }

        if ( $a['search'] ) {
            $like      = '%' . $wpdb->esc_like( $a['search'] ) . '%';
            $where[]   = '(name LIKE %s OR stud_name LIKE %s OR stud_master LIKE %s OR country LIKE %s OR region LIKE %s)';
            $params    = array_merge( $params, array( $like, $like, $like, $like, $like ) );
        }
        if ( $a['country'] ) {
            $country_terms = self::country_filter_terms( $a['country'] );
            $country_parts = array();

            foreach ( $country_terms as $term ) {
                $country_parts[] = 'country = %s';
                $params[] = $term;

                $country_parts[] = 'country LIKE %s';
                $params[] = $term . ' /%';

                $country_parts[] = 'country LIKE %s';
                $params[] = '%/ ' . $term;

                $country_parts[] = 'country LIKE %s';
                $params[] = '%/ ' . $term . ' /%';
            }

            $where[] = '(' . implode( ' OR ', $country_parts ) . ')';
        }
        if ( $a['type'] ) {
            $where[]  = 'type = %s';
            $params[] = $a['type'];
        }
        if ( $a['region'] ) {
            $where[]  = 'region = %s';
            $params[] = $a['region'];
        }
        if ( ! empty( $a['letter'] ) ) {
            if ( $a['letter'] === '#' ) {
                // Names that do not start with a letter A–Z (numbers/symbols).
                $where[] = "LEFT(name,1) NOT REGEXP '[A-Za-z]'";
            } else {
                $where[]  = 'name LIKE %s';
                $params[] = $wpdb->esc_like( $a['letter'] ) . '%';
            }
        }

        $allowed_order = array( 'name', 'stud_name', 'country', 'type', 'created_at' );
        $orderby = in_array( $a['orderby'], $allowed_order ) ? $a['orderby'] : 'name';
        $order   = strtoupper( $a['order'] ) === 'DESC' ? 'DESC' : 'ASC';

        $offset = ( absint( $a['page'] ) - 1 ) * absint( $a['per_page'] );

        $where_sql = implode( ' AND ', $where );

        $count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}";
        $rows_sql  = "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY is_featured DESC, is_paying DESC, {$orderby} {$order} LIMIT %d OFFSET %d";

        if ( $params ) {
            $count = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) );
            $rows  = $wpdb->get_results( $wpdb->prepare( $rows_sql, array_merge( $params, array( $a['per_page'], $offset ) ) ) );
        } else {
            $count = (int) $wpdb->get_var( $count_sql );
            $rows  = $wpdb->get_results( $wpdb->prepare( $rows_sql, $a['per_page'], $offset ) );
        }

        return array(
            'total'    => $count,
            'pages'    => ceil( $count / $a['per_page'] ),
            'page'     => absint( $a['page'] ),
            'per_page' => (int) $a['per_page'],
            'items'    => $rows,
        );
    }

    /** Allowed "view N per page" sizes. */
    public static function per_page_options() {
        return array( 20, 50, 100, 500 );
    }

    public static function clamp_per_page( $value ) {
        $value   = absint( $value );
        $allowed = self::per_page_options();
        return in_array( $value, $allowed, true ) ? $value : 20;
    }

    /**
     * Which first-letters (A–Z, plus '#' for non-alpha) currently have at
     * least one listing — used to enable/disable the alphabet index.
     * Returns an associative array like array( 'A' => true, 'B' => true, … ).
     */
    public static function get_active_letters( $directory_type = '' ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';

        if ( $directory_type !== '' && self::has_column( 'directory_type' ) ) {
            $rows = $wpdb->get_col( $wpdb->prepare(
                "SELECT DISTINCT UPPER(LEFT(name,1)) FROM {$table} WHERE name <> '' AND directory_type = %s",
                HLD_Types::sanitize_slug( $directory_type )
            ) );
        } else {
            $rows = $wpdb->get_col( "SELECT DISTINCT UPPER(LEFT(name,1)) FROM {$table} WHERE name <> ''" );
        }

        $active = array();
        foreach ( (array) $rows as $ch ) {
            if ( $ch === '' ) continue;
            if ( preg_match( '/[A-Z]/', $ch ) ) {
                $active[ $ch ] = true;
            } else {
                $active['#'] = true;
            }
        }
        return $active;
    }

    public static function get_stallion( $id ) {
        global $wpdb;
        return $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}hld_stallions WHERE id = %d",
            absint( $id )
        ) );
    }

    public static function insert_stallion( $data ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';
        $clean = self::sanitize( $data );
        $name      = $clean['name'];
        $stud_name = $clean['stud_name'];
        $dtype     = $clean['directory_type'];

        /* Prevent exact duplicates — same type + same name + same stud */
        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$table} WHERE directory_type = %s AND name = %s AND stud_name = %s LIMIT 1",
            $dtype, $name, $stud_name
        ) );
        if ( $exists ) return $exists; /* return existing ID, don't insert */

        $wpdb->insert( $table, $clean );
        return $wpdb->insert_id;
    }

    public static function update_stallion( $id, $data ) {
        global $wpdb;
        return $wpdb->update(
            $wpdb->prefix . 'hld_stallions',
            self::sanitize( $data ),
            array( 'id' => absint( $id ) )
        );
    }

    public static function replace_stallion_by_name( $data ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';
        $clean = self::sanitize( $data );
        $name  = $clean['name'];
        $dtype = $clean['directory_type'];

        if ( ! $name ) {
            return array( 'id' => 0, 'created' => false, 'duplicates_removed' => 0 );
        }

        /* Match within the same directory type only. */
        $ids = $wpdb->get_col( $wpdb->prepare(
            "SELECT id FROM {$table} WHERE directory_type = %s AND LOWER(name) = LOWER(%s) ORDER BY id ASC",
            $dtype, $name
        ) );

        if ( empty( $ids ) ) {
            $wpdb->insert( $table, $clean );
            return array( 'id' => $wpdb->insert_id, 'created' => true, 'duplicates_removed' => 0 );
        }

        $primary_id = absint( $ids[0] );
        self::update_stallion( $primary_id, $data );

        $duplicates_removed = 0;
        foreach ( array_slice( $ids, 1 ) as $duplicate_id ) {
            $duplicate_id = absint( $duplicate_id );
            self::delete_gallery_for_stallion( $duplicate_id );
            $wpdb->delete( $table, array( 'id' => $duplicate_id ) );
            $duplicates_removed++;
        }

        return array( 'id' => $primary_id, 'created' => false, 'duplicates_removed' => $duplicates_removed );
    }

    public static function delete_stallion( $id ) {
        global $wpdb;
        $id = absint( $id );
        self::delete_gallery_for_stallion( $id );
        self::delete_progeny( $id );
        self::delete_crosses_for_stallion( $id );
        return $wpdb->delete( $wpdb->prefix . 'hld_stallions', array( 'id' => $id ) );
    }

    /**
     * Clear listings. By default (no type) clears everything — preserved for
     * back-compat. Pass a directory type to clear only that category, so a
     * "replace all" stallion import never wipes trainers, vets, etc.
     */
    public static function clear_stallions( $directory_type = '' ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';

        if ( $directory_type === '' ) {
            $wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}hld_gallery" );
            return $wpdb->query( "TRUNCATE TABLE {$table}" );
        }

        $dtype = HLD_Types::sanitize_slug( $directory_type );
        $ids   = $wpdb->get_col( $wpdb->prepare(
            "SELECT id FROM {$table} WHERE directory_type = %s", $dtype
        ) );
        foreach ( $ids as $id ) {
            self::delete_gallery_for_stallion( absint( $id ) );
        }
        return $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE directory_type = %s", $dtype ) );
    }

    /** Count listings, optionally scoped to a directory type. */
    public static function count_listings( $directory_type = '' ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';
        if ( $directory_type === '' || ! self::has_column( 'directory_type' ) ) {
            return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
        }
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE directory_type = %s",
            HLD_Types::sanitize_slug( $directory_type )
        ) );
    }

    /** Listing counts grouped by directory type: array( slug => count ). */
    public static function counts_by_type() {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_stallions';
        if ( ! self::has_column( 'directory_type' ) ) {
            return array( 'stallion' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ) );
        }
        $rows = $wpdb->get_results( "SELECT directory_type AS dtype, COUNT(*) AS n FROM {$table} GROUP BY directory_type" );
        $out  = array();
        foreach ( $rows as $r ) {
            $out[ $r->dtype ] = (int) $r->n;
        }
        return $out;
    }

    /** Re-point listings from one directory type slug to another (on rename). */
    public static function rename_directory_type( $old, $new ) {
        global $wpdb;
        if ( ! self::has_column( 'directory_type' ) ) return 0;
        return $wpdb->update(
            $wpdb->prefix . 'hld_stallions',
            array( 'directory_type' => HLD_Types::sanitize_slug( $new ) ),
            array( 'directory_type' => HLD_Types::sanitize_slug( $old ) )
        );
    }

    public static function get_distinct( $col, $directory_type = '' ) {
        global $wpdb;
        $table   = $wpdb->prefix . 'hld_stallions';
        $allowed = array( 'country', 'region', 'type' );
        if ( ! in_array( $col, $allowed ) ) return array();

        if ( $directory_type !== '' && self::has_column( 'directory_type' ) ) {
            return $wpdb->get_col( $wpdb->prepare(
                "SELECT DISTINCT {$col} FROM {$table} WHERE {$col} != '' AND directory_type = %s ORDER BY {$col} ASC",
                HLD_Types::sanitize_slug( $directory_type )
            ) );
        }
        return $wpdb->get_col( "SELECT DISTINCT {$col} FROM {$table} WHERE {$col} != '' ORDER BY {$col} ASC" );
    }

    public static function get_country_filter_options() {
        return array(
            'AU' => 'Australia',
            'NZ' => 'New Zealand',
            'US' => 'USA',
            'FR' => 'France',
        );
    }

    private static function country_filter_terms( $country ) {
        $token = self::normalise_country_token( $country );

        if ( $token === 'AU' ) return array( 'AU', 'Australia' );
        if ( $token === 'NZ' ) return array( 'NZ', 'New Zealand' );
        if ( $token === 'US' ) return array( 'US', 'USA', 'United States' );
        if ( $token === 'FR' ) return array( 'FR', 'France' );

        return array( sanitize_text_field( $country ) );
    }

    private static function normalise_country_token( $country ) {
        $country = strtoupper( trim( (string) $country ) );

        if ( in_array( $country, array( 'AU', 'AUS', 'AUSTRALIA' ), true ) ) return 'AU';
        if ( in_array( $country, array( 'NZ', 'NEW ZEALAND' ), true ) ) return 'NZ';
        if ( in_array( $country, array( 'US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA' ), true ) ) return 'US';
        if ( in_array( $country, array( 'FR', 'FRA', 'FRANCE' ), true ) ) return 'FR';

        return sanitize_text_field( $country );
    }

    private static function sanitize( $data ) {
        $dtype = HLD_Types::sanitize_slug( $data['directory_type'] ?? '' );
        if ( ! $dtype || ! HLD_Types::exists( $dtype ) ) {
            $dtype = 'stallion';
        }

        return array(
            'directory_type'  => $dtype,
            'name'            => sanitize_text_field( $data['name'] ?? '' ),
            'stud_name'       => sanitize_text_field( $data['stud_name'] ?? $data['stud'] ?? '' ),
            'country'         => sanitize_text_field( $data['country'] ?? '' ),
            'region'          => sanitize_text_field( $data['region'] ?? '' ),
            'suburb'          => sanitize_text_field( $data['suburb'] ?? '' ),
            'industry'        => sanitize_text_field( $data['industry'] ?? '' ),
            'coverage'        => sanitize_textarea_field( $data['coverage'] ?? '' ),
            'stud_master'     => sanitize_text_field( $data['stud_master'] ?? '' ),
            'type'            => in_array( $data['type'] ?? '', array( 'Pacer', 'Trotter' ) ) ? $data['type'] : 'Pacer',
            'status_note'     => sanitize_text_field( $data['status_note'] ?? '' ),
            'is_paying'       => ! empty( $data['is_paying'] ) ? 1 : 0,
            'is_featured'     => ! empty( $data['is_featured'] ) ? 1 : 0,
            'contact_phone'   => sanitize_text_field( $data['contact_phone'] ?? '' ),
            'contact_email'   => sanitize_email( $data['contact_email'] ?? '' ),
            'contact_website' => esc_url_raw( $data['contact_website'] ?? '' ),
            'stud_website'    => esc_url_raw( $data['stud_website'] ?? '' ),
            'contact_address' => sanitize_textarea_field( $data['contact_address'] ?? '' ),
            'contact_au'      => sanitize_textarea_field( $data['contact_au'] ?? '' ),
            'contact_us'      => sanitize_textarea_field( $data['contact_us'] ?? '' ),
            'contact_nz'      => sanitize_textarea_field( $data['contact_nz'] ?? '' ),
            'contact_fr'      => sanitize_textarea_field( $data['contact_fr'] ?? '' ),
            'contact_other'   => sanitize_textarea_field( $data['contact_other'] ?? '' ),
            'profile_bio'     => wp_kses_post( $data['profile_bio'] ?? '' ),
            'profile_image'   => sanitize_text_field( $data['profile_image'] ?? '' ),
            'race_record'     => sanitize_text_field( $data['race_record'] ?? '' ),
            'career_earnings' => sanitize_text_field( $data['career_earnings'] ?? '' ),
            'service_fee'     => sanitize_text_field( $data['service_fee'] ?? '' ),
            'progeny_note'    => sanitize_textarea_field( $data['progeny_note'] ?? '' ),

            /* ── Profile / hero / summary ── */
            'tagline'         => sanitize_text_field( $data['tagline'] ?? '' ),
            'short_summary'   => sanitize_textarea_field( $data['short_summary'] ?? '' ),
            'year_of_birth'   => sanitize_text_field( $data['year_of_birth'] ?? '' ),
            'colour'          => sanitize_text_field( $data['colour'] ?? '' ),
            'sex'             => sanitize_text_field( $data['sex'] ?? '' ),
            'booking_url'     => esc_url_raw( $data['booking_url'] ?? '' ),
            'booking_label'   => sanitize_text_field( $data['booking_label'] ?? '' ),
            'hero_image_id'   => absint( $data['hero_image_id'] ?? 0 ),

            /* ── Crosses of Gold intro + related horses ── */
            'crosses_intro'   => wp_kses_post( $data['crosses_intro'] ?? '' ),
            'related_ids'     => self::sanitize_related_ids( $data['related_ids'] ?? '' ),

            /* ── Pedigree ── Each field is "Name" or "Name\nRecord" (e.g. "p,3,1:50"); a
               textarea in the admin, so newlines must survive sanitisation. */
            'ped_sire' => self::sanitize_pedigree_field( $data['ped_sire'] ?? '' ),
            'ped_dam'  => self::sanitize_pedigree_field( $data['ped_dam']  ?? '' ),
            'ped_ss'   => self::sanitize_pedigree_field( $data['ped_ss']   ?? '' ),
            'ped_sd'   => self::sanitize_pedigree_field( $data['ped_sd']   ?? '' ),
            'ped_ds'   => self::sanitize_pedigree_field( $data['ped_ds']   ?? '' ),
            'ped_dd'   => self::sanitize_pedigree_field( $data['ped_dd']   ?? '' ),
            'ped_sss'  => self::sanitize_pedigree_field( $data['ped_sss']  ?? '' ),
            'ped_ssd'  => self::sanitize_pedigree_field( $data['ped_ssd']  ?? '' ),
            'ped_sds'  => self::sanitize_pedigree_field( $data['ped_sds']  ?? '' ),
            'ped_sdd'  => self::sanitize_pedigree_field( $data['ped_sdd']  ?? '' ),
            'ped_dss'  => self::sanitize_pedigree_field( $data['ped_dss']  ?? '' ),
            'ped_dsd'  => self::sanitize_pedigree_field( $data['ped_dsd']  ?? '' ),
            'ped_dds'  => self::sanitize_pedigree_field( $data['ped_dds']  ?? '' ),
            'ped_ddd'  => self::sanitize_pedigree_field( $data['ped_ddd']  ?? '' ),
        );
    }

    /**
     * Pedigree fields are entered as "Name" or "Name\nRecord" (e.g. a race
     * record like "p,3,1:50"). sanitize_text_field() would collapse the
     * newline into a space, so use the textarea variant, capped to two lines.
     */
    private static function sanitize_pedigree_field( $value ) {
        $value = sanitize_textarea_field( $value );
        $lines = array_slice( array_map( 'trim', explode( "\n", $value ) ), 0, 2 );
        return implode( "\n", array_filter( $lines, 'strlen' ) );
    }

    /** Accepts a JSON string or an array of listing IDs; stores a clean JSON array. */
    private static function sanitize_related_ids( $value ) {
        if ( is_string( $value ) ) {
            $decoded = json_decode( $value, true );
            $value   = is_array( $decoded ) ? $decoded : array_filter( explode( ',', $value ) );
        }
        $ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $value ) ) ) );
        return $ids ? wp_json_encode( $ids ) : '';
    }

    /** Decode a stored related_ids JSON string back into an int array. */
    public static function decode_related_ids( $value ) {
        $decoded = json_decode( (string) $value, true );
        return is_array( $decoded ) ? array_values( array_unique( array_filter( array_map( 'absint', $decoded ) ) ) ) : array();
    }

    /** Fetch related listings by ID, in the stored order, skipping any that no longer exist. */
    public static function get_related_listings( $ids, $limit = 4 ) {
        global $wpdb;
        $ids = array_filter( array_map( 'absint', (array) $ids ) );
        if ( ! $ids ) return array();

        $table        = $wpdb->prefix . 'hld_stallions';
        $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
        $rows         = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE id IN ({$placeholders})", $ids
        ) );

        $by_id = array();
        foreach ( $rows as $row ) $by_id[ (int) $row->id ] = $row;

        $ordered = array();
        foreach ( $ids as $id ) {
            if ( isset( $by_id[ $id ] ) ) $ordered[] = $by_id[ $id ];
            if ( $limit && count( $ordered ) >= $limit ) break;
        }
        return $ordered;
    }

    /* ════════════════════════════════════
       ENQUIRIES
    ════════════════════════════════════ */

    public static function insert_enquiry( $data ) {
        global $wpdb;

        // Accept any registered directory type label (singular or plural).
        $requested = sanitize_text_field( $data['listing_type'] ?? '' );
        $listing_type = 'Stallion';
        foreach ( HLD_Types::get_all() as $t ) {
            if ( strcasecmp( $requested, $t['singular'] ) === 0 || strcasecmp( $requested, $t['plural'] ) === 0 ) {
                $listing_type = $t['singular'];
                break;
            }
        }
        if ( $requested && $listing_type === 'Stallion' && strcasecmp( $requested, 'Stallion' ) !== 0 ) {
            // Unknown but non-empty label — keep it rather than discard.
            $listing_type = $requested;
        }

        $record = array(
            'listing_type'  => $listing_type,
            'contact_name'  => sanitize_text_field( $data['contact_name'] ?? '' ),
            'contact_email' => sanitize_email( $data['contact_email'] ?? '' ),
            'contact_phone' => sanitize_text_field( $data['contact_phone'] ?? '' ),
            'stud_name'     => sanitize_text_field( $data['stud_name'] ?? '' ),
            'country'       => sanitize_text_field( $data['country'] ?? '' ),
            'region'        => sanitize_text_field( $data['region'] ?? '' ),
            'message'       => sanitize_textarea_field( $data['message'] ?? '' ),
            'status'        => 'new',
        );

        $wpdb->insert( $wpdb->prefix . 'hld_enquiries', $record );
        return $wpdb->insert_id;
    }

    public static function get_enquiries( $args = array() ) {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_enquiries';

        $defaults = array(
            'status'   => '',
            'page'     => 1,
            'per_page' => 25,
        );
        $a = wp_parse_args( $args, $defaults );

        $where  = array( '1=1' );
        $params = array();

        if ( $a['status'] ) {
            $where[]  = 'status = %s';
            $params[] = $a['status'];
        }

        $where_sql = implode( ' AND ', $where );
        $offset    = ( absint( $a['page'] ) - 1 ) * absint( $a['per_page'] );

        if ( $params ) {
            $count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}", $params ) );
            $rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY submitted_at DESC LIMIT %d OFFSET %d", array_merge( $params, array( $a['per_page'], $offset ) ) ) );
        } else {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
            $rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} ORDER BY submitted_at DESC LIMIT %d OFFSET %d", $a['per_page'], $offset ) );
        }

        return array(
            'total' => $count,
            'pages' => max( 1, ceil( $count / $a['per_page'] ) ),
            'page'  => absint( $a['page'] ),
            'items' => $rows,
        );
    }

    public static function get_enquiry( $id ) {
        global $wpdb;
        return $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}hld_enquiries WHERE id = %d",
            absint( $id )
        ) );
    }

    public static function update_enquiry_status( $id, $status, $notes = '' ) {
        global $wpdb;
        $allowed = array( 'new', 'contacted', 'converted', 'dismissed' );
        if ( ! in_array( $status, $allowed ) ) return false;
        return $wpdb->update(
            $wpdb->prefix . 'hld_enquiries',
            array(
                'status'      => $status,
                'admin_notes' => sanitize_textarea_field( $notes ),
            ),
            array( 'id' => absint( $id ) )
        );
    }

    public static function delete_enquiry( $id ) {
        global $wpdb;
        return $wpdb->delete( $wpdb->prefix . 'hld_enquiries', array( 'id' => absint( $id ) ) );
    }

    public static function count_new_enquiries() {
        global $wpdb;
        return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}hld_enquiries WHERE status = 'new'" );
    }

    /* ════════════════════════════════════
       GALLERY
    ════════════════════════════════════ */

    public static function get_gallery( $stallion_id ) {
        global $wpdb;
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}hld_gallery WHERE stallion_id = %d ORDER BY sort_order ASC, id ASC",
            absint( $stallion_id )
        ) );
    }

    public static function add_gallery_item( $stallion_id, $data ) {
        global $wpdb;
        $allowed = array( 'image', 'video' );
        $wpdb->insert( $wpdb->prefix . 'hld_gallery', array(
            'stallion_id'   => absint( $stallion_id ),
            'media_type'    => in_array( $data['media_type'] ?? 'image', $allowed ) ? $data['media_type'] : 'image',
            'url'           => esc_url_raw( $data['url'] ?? '' ),
            'attachment_id' => absint( $data['attachment_id'] ?? 0 ),
            'caption'       => sanitize_text_field( $data['caption'] ?? '' ),
            'description'   => sanitize_textarea_field( $data['description'] ?? '' ),
            'sort_order'    => absint( $data['sort_order'] ?? 0 ),
        ) );
        return $wpdb->insert_id;
    }

    public static function update_gallery_item( $id, $data ) {
        global $wpdb;
        $update = array();
        if ( isset( $data['caption'] ) ) {
            $update['caption'] = sanitize_text_field( $data['caption'] );
        }
        if ( isset( $data['description'] ) ) {
            $update['description'] = sanitize_textarea_field( $data['description'] );
        }
        if ( isset( $data['sort_order'] ) ) {
            $update['sort_order'] = absint( $data['sort_order'] );
        }
        if ( ! $update ) return false;
        return $wpdb->update(
            $wpdb->prefix . 'hld_gallery',
            $update,
            array( 'id' => absint( $id ) )
        );
    }

    public static function delete_gallery_item( $id ) {
        global $wpdb;
        return $wpdb->delete( $wpdb->prefix . 'hld_gallery', array( 'id' => absint( $id ) ) );
    }

    public static function reorder_gallery( $stallion_id, $ordered_ids ) {
        global $wpdb;
        foreach ( $ordered_ids as $sort => $item_id ) {
            $wpdb->update(
                $wpdb->prefix . 'hld_gallery',
                array( 'sort_order' => absint( $sort ) ),
                array( 'id' => absint( $item_id ), 'stallion_id' => absint( $stallion_id ) )
            );
        }
    }

    public static function delete_gallery_for_stallion( $stallion_id ) {
        global $wpdb;
        return $wpdb->delete( $wpdb->prefix . 'hld_gallery', array( 'stallion_id' => absint( $stallion_id ) ) );
    }

    /* ════════════════════════════════════
       PROGENY
    ════════════════════════════════════ */

    /** All progeny for a stallion, ordered by prizemoney (desc) then sort. */
    public static function get_progeny( $stallion_id ) {
        global $wpdb;
        if ( ! self::has_progeny_table() ) return array();
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}hld_progeny WHERE stallion_id = %d
             ORDER BY prizemoney_num DESC, sort_order ASC, id ASC",
            absint( $stallion_id )
        ) );
    }

    public static function count_progeny( $stallion_id ) {
        global $wpdb;
        if ( ! self::has_progeny_table() ) return 0;
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}hld_progeny WHERE stallion_id = %d",
            absint( $stallion_id )
        ) );
    }

    private static function sanitize_progeny( $stallion_id, $data ) {
        $money_raw = (string) ( $data['prizemoney'] ?? '' );
        $money_num = isset( $data['prizemoney_num'] )
            ? absint( $data['prizemoney_num'] )
            : (int) preg_replace( '/[^0-9]/', '', $money_raw );

        return array(
            'stallion_id'    => absint( $stallion_id ),
            'name'           => sanitize_text_field( $data['name'] ?? '' ),
            'foaling_date'   => sanitize_text_field( $data['foaling_date'] ?? '' ),
            'country'        => sanitize_text_field( $data['country'] ?? '' ),
            'sex'            => sanitize_text_field( $data['sex'] ?? '' ),
            'dam'            => sanitize_text_field( $data['dam'] ?? '' ),
            'broodmare_sire' => sanitize_text_field( $data['broodmare_sire'] ?? '' ),
            'prizemoney'     => sanitize_text_field( $money_raw ),
            'prizemoney_num' => $money_num,
            'mile_rate'      => sanitize_text_field( $data['mile_rate'] ?? '' ),
            'starts'         => absint( $data['starts'] ?? 0 ),
            'wins'           => absint( $data['wins'] ?? 0 ),
            'sort_order'     => absint( $data['sort_order'] ?? 0 ),
        );
    }

    public static function add_progeny( $stallion_id, $data ) {
        global $wpdb;
        if ( ! self::has_progeny_table() ) return 0;
        $wpdb->insert( $wpdb->prefix . 'hld_progeny', self::sanitize_progeny( $stallion_id, $data ) );
        return $wpdb->insert_id;
    }

    /** Replace the entire progeny set for a stallion with the given rows. */
    public static function replace_progeny( $stallion_id, $rows ) {
        global $wpdb;
        if ( ! self::has_progeny_table() ) return 0;
        $stallion_id = absint( $stallion_id );
        $wpdb->delete( $wpdb->prefix . 'hld_progeny', array( 'stallion_id' => $stallion_id ) );
        $count = 0;
        $sort  = 0;
        foreach ( (array) $rows as $row ) {
            if ( empty( $row['name'] ) ) continue;
            $row['sort_order'] = $sort++;
            $wpdb->insert( $wpdb->prefix . 'hld_progeny', self::sanitize_progeny( $stallion_id, $row ) );
            $count++;
        }
        return $count;
    }

    public static function delete_progeny( $stallion_id ) {
        global $wpdb;
        if ( ! self::has_progeny_table() ) return 0;
        return $wpdb->delete( $wpdb->prefix . 'hld_progeny', array( 'stallion_id' => absint( $stallion_id ) ) );
    }

    public static function has_progeny_table() {
        global $wpdb;
        $table = $wpdb->prefix . 'hld_progeny';
        return (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
    }

    /**
     * Map of stallion name (matched apostrophe/loose) => seed data file under
     * /data. Add new stallions here as Brendan supplies their progeny sheets.
     */
    private static function progeny_seed_map() {
        return array(
            'bettors delight' => 'data/bettors-delight-progeny.php',
            'colt thirty one' => 'data/colt-thirty-one-progeny.php',
        );
    }

    /**
     * Optional intro line shown above a stallion's progeny table. Keyed by a
     * loose, apostrophe-insensitive name match. Add new stallions as needed.
     */
    public static function progeny_intro( $name ) {
        $key = strtolower( trim( (string) $name ) );
        $key = str_replace( array( "'", '’' ), '', $key );

        $intros = array(
            'bettors delight' => 'First crop of progeny began racing in the 2005/2006 season.',
            'colt thirty one' => 'First crop of progeny began racing in the 2026 season.',
        );
        foreach ( $intros as $match => $line ) {
            if ( strpos( $key, $match ) !== false ) {
                return $line;
            }
        }
        return '';
    }

    /**
     * One-time seed of bundled progeny sheets (Southern Hemisphere set from
     * Brendan). Runs once; for each mapped stallion, only fills if the stallion
     * exists and currently has no progeny (never clobbers manual edits).
     */
    public static function seed_progeny_data() {
        global $wpdb;
        if ( ! self::has_progeny_table() ) return;
        $table = $wpdb->prefix . 'hld_stallions';

        foreach ( self::progeny_seed_map() as $match => $rel_file ) {
            $id = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT id FROM {$table} WHERE directory_type = 'stallion'
                 AND REPLACE(REPLACE(LOWER(name),'\\'',''),'’','') LIKE %s
                 ORDER BY id ASC LIMIT 1",
                '%' . $wpdb->esc_like( $match ) . '%'
            ) );
            if ( ! $id ) continue;

            // Never overwrite progeny an admin has managed by hand. Manual CSV
            // import / Clear All set the provenance flag to 'manual'; anything
            // else (empty, or a previous bundled seed) may be (re)seeded so the
            // corrected Southern-Hemisphere data replaces the old bundled set.
            if ( get_option( 'hld_progeny_src_' . $id, '' ) === 'manual' ) continue;

            $seed_file = HLD_PLUGIN_DIR . $rel_file;
            if ( ! is_readable( $seed_file ) ) continue;
            $rows = include $seed_file;
            if ( ! is_array( $rows ) || empty( $rows ) ) continue;

            self::replace_progeny( $id, $rows );
            update_option( 'hld_progeny_src_' . $id, $rel_file );
        }
    }

    /** Back-compat alias. */
    public static function seed_bettors_delight_progeny() {
        self::seed_progeny_data();
    }

    /* ════════════════════════════════════
       CROSSES OF GOLD (per-stallion, repeatable)
    ════════════════════════════════════ */

    public static function get_crosses( $stallion_id ) {
        global $wpdb;
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}hld_crosses WHERE stallion_id = %d ORDER BY sort_order ASC, id ASC",
            absint( $stallion_id )
        ) );
    }

    private static function sanitize_cross( $stallion_id, $data ) {
        return array(
            'stallion_id' => absint( $stallion_id ),
            'title'       => sanitize_text_field( $data['title'] ?? '' ),
            'description' => wp_kses_post( $data['description'] ?? '' ),
            'examples'    => sanitize_textarea_field( $data['examples'] ?? '' ),
            'sort_order'  => absint( $data['sort_order'] ?? 0 ),
        );
    }

    public static function add_cross( $stallion_id, $data ) {
        global $wpdb;
        $existing = self::get_crosses( $stallion_id );
        $data['sort_order'] = count( $existing );
        $wpdb->insert( $wpdb->prefix . 'hld_crosses', self::sanitize_cross( $stallion_id, $data ) );
        return $wpdb->insert_id;
    }

    public static function update_cross( $id, $data ) {
        global $wpdb;
        $update = array();
        if ( isset( $data['title'] ) )       $update['title']       = sanitize_text_field( $data['title'] );
        if ( isset( $data['description'] ) ) $update['description'] = wp_kses_post( $data['description'] );
        if ( isset( $data['examples'] ) )    $update['examples']    = sanitize_textarea_field( $data['examples'] );
        if ( isset( $data['sort_order'] ) )  $update['sort_order']  = absint( $data['sort_order'] );
        if ( ! $update ) return false;
        return $wpdb->update( $wpdb->prefix . 'hld_crosses', $update, array( 'id' => absint( $id ) ) );
    }

    public static function delete_cross( $id ) {
        global $wpdb;
        return $wpdb->delete( $wpdb->prefix . 'hld_crosses', array( 'id' => absint( $id ) ) );
    }

    public static function reorder_crosses( $stallion_id, $ordered_ids ) {
        global $wpdb;
        foreach ( $ordered_ids as $sort => $item_id ) {
            $wpdb->update(
                $wpdb->prefix . 'hld_crosses',
                array( 'sort_order' => absint( $sort ) ),
                array( 'id' => absint( $item_id ), 'stallion_id' => absint( $stallion_id ) )
            );
        }
    }

    public static function delete_crosses_for_stallion( $stallion_id ) {
        global $wpdb;
        return $wpdb->delete( $wpdb->prefix . 'hld_crosses', array( 'stallion_id' => absint( $stallion_id ) ) );
    }

}
