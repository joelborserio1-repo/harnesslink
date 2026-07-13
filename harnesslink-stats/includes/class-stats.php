<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HL_Stats {

    const POSTS_PER_PAGE = 50;
    const DB_PREFIX      = 'wzev_';

    // How many periods to show in the daily / weekly output matrices when
    // no explicit date range is chosen (keeps the table readable).
    const MAX_DAILY_ROWS  = 90;
    const MAX_WEEKLY_ROWS = 52;

    // Max category columns to show in the output matrix before bucketing the
    // remainder into an "Other" column.
    const MAX_CAT_COLS = 12;

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'add_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
        add_action( 'admin_init', [ $this, 'maybe_migrate' ] );
        add_action( 'admin_init', [ $this, 'maybe_export_csv' ] );
        add_action( 'wp_ajax_hl_verify_pin', [ $this, 'ajax_verify_pin' ] );
        add_action( 'wp_ajax_hl_lock',       [ $this, 'ajax_lock' ] );

        // Skip the language-pack update step that fails when
        // wp-content/languages isn't writable by the web-server user.
        add_filter( 'site_transient_update_core',    [ $this, 'skip_translation_updates' ] );
        add_filter( 'site_transient_update_plugins', [ $this, 'skip_translation_updates' ] );
        add_filter( 'site_transient_update_themes',  [ $this, 'skip_translation_updates' ] );
    }

    /**
     * Clear pending translation updates so WordPress doesn't try (and fail)
     * to copy language files after a plugin update.
     *
     * On this server the wp-content/languages directory isn't writable by the
     * web-server user, so the bundled "Updating translations…" step throws a
     * "files could not be copied" error after every plugin update. Emptying
     * the translation list makes that step a no-op.
     *
     * This does NOT affect plugin, theme, or core updates — only language
     * packs. To restore automatic translation updates, either delete this
     * plugin or make wp-content/languages writable by the web-server user.
     */
    public function skip_translation_updates( $value ) {
        if ( is_object( $value ) && isset( $value->translations ) ) {
            $value->translations = [];
        }
        return $value;
    }

    /**
     * One-time migration: force the dashboard PIN to 1234 on upgrade.
     * Guarded by a flag so a later admin PIN change is preserved.
     */
    public function maybe_migrate() {
        if ( ! get_option( 'hl_stats_pin_forced_1234' ) ) {
            update_option( 'hl_stats_pin', '1234' );
            update_option( 'hl_stats_pin_forced_1234', 1 );
        }
    }

    public function add_menu() {
        add_management_page( 'Journalist Stats', 'Journalist Stats', 'manage_options', 'hl-journalist-stats', [ $this, 'render_page' ] );
        add_submenu_page( 'tools.php', 'Journalist Costs', 'Journalist Costs', 'manage_options', 'hl-journalist-costs', [ $this, 'render_costs_page' ] );
    }

    public function enqueue_assets( string $hook ) {
        if ( ! in_array( $hook, [ 'tools_page_hl-journalist-stats', 'tools_page_hl-journalist-costs' ], true ) ) return;
        wp_enqueue_style( 'hl-stats', HL_STATS_URL . 'css/admin.css', [], HL_STATS_VERSION );
        wp_enqueue_script( 'hl-stats-js', HL_STATS_URL . 'js/admin.js', [], HL_STATS_VERSION, true );
        wp_localize_script( 'hl-stats-js', 'hlStats', [ 'ajaxUrl' => admin_url( 'admin-ajax.php' ), 'nonce' => wp_create_nonce( 'hl_pin_nonce' ) ] );
    }


    // -------------------------------------------------------------------------
    // PIN / session helpers
    // -------------------------------------------------------------------------

    private function get_pin() {
        return (string) get_option( 'hl_stats_pin', '1234' );
    }

    private function is_unlocked() {
        return ! empty( $_SESSION['hl_stats_unlocked'] );
    }

    private function start_session() {
        if ( ! session_id() ) session_start();
    }

    public function ajax_verify_pin() {
        check_ajax_referer( 'hl_pin_nonce', 'nonce' );
        $this->start_session();
        if ( sanitize_text_field( $_POST['pin'] ?? '' ) === $this->get_pin() ) {
            $_SESSION['hl_stats_unlocked'] = true;
            wp_send_json_success();
        } else {
            wp_send_json_error();
        }
    }

    public function ajax_lock() {
        check_ajax_referer( 'hl_pin_nonce', 'nonce' );
        $this->start_session();
        unset( $_SESSION['hl_stats_unlocked'] );
        wp_send_json_success();
    }

    // -------------------------------------------------------------------------
    // Taxonomy helpers (the "category" dimension — USA, AU, etc.)
    // -------------------------------------------------------------------------

    private function get_taxonomy(): string {
        $tax = (string) get_option( 'hl_stats_taxonomy', 'category' );
        return taxonomy_exists( $tax ) ? $tax : 'category';
    }

    /** All terms in the configured taxonomy (for the filter dropdown). */
    private function get_all_terms(): array {
        $terms = get_terms( [ 'taxonomy' => $this->get_taxonomy(), 'hide_empty' => false ] );
        return is_wp_error( $terms ) ? [] : $terms;
    }

    // -------------------------------------------------------------------------
    // Cost helpers
    // -------------------------------------------------------------------------

    private function get_cost_config( $user_id ): array {
        $costs = get_option( 'hl_journalist_costs', [] );
        return $costs[ $user_id ] ?? [ 'type' => 'per_story', 'amount' => 100 ];
    }

    private function calculate_cost( array $config, int $articles, string $date_from, string $date_to ): float {
        if ( $config['type'] === 'per_story' ) return $articles * $config['amount'];
        $from   = new DateTime( $date_from ?: '2000-01-01' );
        $to     = new DateTime( $date_to   ?: 'now' );
        $from->modify( 'first day of this month' );
        $to->modify( 'first day of this month' );
        $diff   = $from->diff( $to );
        $months = max( 1, $diff->y * 12 + $diff->m + 1 );
        return $config['amount'] * $months;
    }

    private function cpv_class( float $cpv ): string {
        return $cpv < 0.10 ? 'cpv-good' : ( $cpv > 0.50 ? 'cpv-bad' : 'cpv-ok' );
    }

    private function fmt_cpv( float $cost, int $views ): array {
        if ( $views <= 0 ) return [ 'label' => 'N/A', 'val' => 999 ];
        $v = $cost / $views;
        return [ 'label' => '$' . number_format( $v, 2 ), 'val' => $v ];
    }

    // -------------------------------------------------------------------------
    // Where clause builder
    // -------------------------------------------------------------------------

    private function build_where( array $filters ): array {
        global $wpdb;
        $where  = "WHERE p.post_type='post' AND p.post_status='publish'";
        $params = [];
        if ( ! empty( $filters['author_id'] ) ) { $where .= " AND p.post_author=%d"; $params[] = (int)$filters['author_id']; }
        if ( ! empty( $filters['date_from'] ) ) { $where .= " AND DATE(p.post_date)>=%s"; $params[] = $filters['date_from']; }
        if ( ! empty( $filters['date_to']   ) ) { $where .= " AND DATE(p.post_date)<=%s"; $params[] = $filters['date_to']; }
        if ( ! empty( $filters['term_id']   ) ) {
            $where .= " AND p.ID IN ( SELECT tr.object_id FROM {$wpdb->term_relationships} tr
                        INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
                        WHERE tt.taxonomy = %s AND tt.term_id = %d )";
            $params[] = $this->get_taxonomy();
            $params[] = (int) $filters['term_id'];
        }
        return [ $where, $params ];
    }

    // -------------------------------------------------------------------------
    // Range length in days (for per-day / per-week averages)
    // -------------------------------------------------------------------------

    private function get_range_days( array $filters ): int {
        // If an explicit range is set, use it verbatim.
        if ( ! empty( $filters['date_from'] ) && ! empty( $filters['date_to'] ) ) {
            $from = strtotime( $filters['date_from'] );
            $to   = strtotime( $filters['date_to'] );
            if ( $from && $to && $to >= $from ) return (int) floor( ( $to - $from ) / 86400 ) + 1;
        }
        // Otherwise derive from the earliest / latest matching post.
        global $wpdb;
        [ $where, $params ] = $this->build_where( $filters );
        $sql  = "SELECT DATEDIFF( MAX(DATE(p.post_date)), MIN(DATE(p.post_date)) ) + 1
                 FROM {$wpdb->posts} p $where";
        $days = empty( $params )
            ? $wpdb->get_var( $sql )
            : $wpdb->get_var( $wpdb->prepare( $sql, ...$params ) );
        return max( 1, (int) $days );
    }

    // -------------------------------------------------------------------------
    // STORY OUTPUT — counts of published posts per day / week
    // -------------------------------------------------------------------------

    /**
     * Total published stories per period.
     * $granularity: 'day' | 'week'. Returns most-recent first, capped by $limit.
     * Each row: [ 'pk' => key, 'label' => human, 'wk_start' => Y-m-d, 'stories' => int ]
     */
    private function get_output_periods( array $filters, string $granularity ): array {
        global $wpdb;
        [ $where, $params ] = $this->build_where( $filters );

        if ( $granularity === 'week' ) {
            $limit  = self::MAX_WEEKLY_ROWS;
            $pk_sql = "YEARWEEK(p.post_date,1)";
            $sql    = "SELECT $pk_sql AS pk, MIN(DATE(p.post_date)) AS wk_start, COUNT(DISTINCT p.ID) AS stories
                       FROM {$wpdb->posts} p $where
                       GROUP BY pk ORDER BY pk DESC LIMIT %d";
        } else {
            $limit  = self::MAX_DAILY_ROWS;
            $pk_sql = "DATE(p.post_date)";
            $sql    = "SELECT $pk_sql AS pk, DATE(p.post_date) AS wk_start, COUNT(DISTINCT p.ID) AS stories
                       FROM {$wpdb->posts} p $where
                       GROUP BY pk ORDER BY pk DESC LIMIT %d";
        }

        $all_params = array_merge( $params, [ $limit ] );
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$all_params ), ARRAY_A );

        $out = [];
        foreach ( (array) $rows as $r ) {
            $label = $granularity === 'week'
                ? 'w/c ' . date( 'd M Y', strtotime( $r['wk_start'] ) )
                : date( 'D d M Y', strtotime( $r['wk_start'] ) );
            $out[] = [
                'pk'       => (string) $r['pk'],
                'label'    => $label,
                'wk_start' => $r['wk_start'],
                'stories'  => (int) $r['stories'],
            ];
        }
        return $out;
    }

    /**
     * Story counts per period BROKEN DOWN by category term.
     * Returns [ pk => [ term_id => count ] ].
     * Note: a story in N categories counts once per category, so category
     * counts can exceed the distinct story total for a period.
     */
    private function get_output_matrix( array $filters, string $granularity ): array {
        global $wpdb;
        [ $where, $params ] = $this->build_where( $filters );
        $tax    = $this->get_taxonomy();
        $pk_sql = $granularity === 'week' ? "YEARWEEK(p.post_date,1)" : "DATE(p.post_date)";

        $sql = "SELECT $pk_sql AS pk, tt.term_id AS term_id, COUNT(DISTINCT p.ID) AS c
                FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID
                INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = %s
                $where
                GROUP BY pk, tt.term_id";

        $all_params = array_merge( [ $tax ], $params );
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$all_params ), ARRAY_A );

        $matrix = [];
        foreach ( (array) $rows as $r ) {
            $matrix[ (string) $r['pk'] ][ (int) $r['term_id'] ] = (int) $r['c'];
        }
        return $matrix;
    }

    // -------------------------------------------------------------------------
    // STORY OUTPUT — by category (USA, AU, …)
    // -------------------------------------------------------------------------

    private function get_category_summary( array $filters ): array {
        global $wpdb;
        [ $where, $params ] = $this->build_where( $filters );
        $tax = $this->get_taxonomy();

        $sql = "SELECT t.term_id, t.name AS term_name, COUNT(DISTINCT p.ID) AS stories
                FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID
                INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = %s
                INNER JOIN {$wpdb->terms} t ON t.term_id = tt.term_id
                $where
                GROUP BY t.term_id, t.name
                ORDER BY stories DESC";

        $all_params = array_merge( [ $tax ], $params );
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$all_params ), ARRAY_A );

        $rows       = array_map( function ( $r ) {
            return [ 'term_id' => (int) $r['term_id'], 'term_name' => $r['term_name'], 'stories' => (int) $r['stories'] ];
        }, (array) $rows );

        $range_days = $this->get_range_days( $filters );
        $weeks      = max( 1, $range_days / 7 );
        $top        = $rows[0]['stories'] ?? 0;

        foreach ( $rows as &$r ) {
            $r['avg_day']  = round( $r['stories'] / $range_days, 2 );
            $r['avg_week'] = round( $r['stories'] / $weeks, 1 );
            $r['bar']      = $top > 0 ? round( ( $r['stories'] / $top ) * 100 ) : 0;
        }
        unset( $r );

        return $rows;
    }

    // -------------------------------------------------------------------------
    // Journalist summary — uses wzev_popularpostsdata for all-time totals
    // and wzev_popularpostssummary for date-filtered totals
    // -------------------------------------------------------------------------

    private function get_molongui_guests(): array {
        return (array) get_option( 'hl_molongui_guests', [] );
    }

    private function get_molongui_guest_rows( array $filters ): array {
        global $wpdb;

        $guests    = $this->get_molongui_guests();
        $has_dates = ! empty( $filters['date_from'] ) || ! empty( $filters['date_to'] );
        $rows      = [];

        foreach ( $guests as $guest ) {
            $meta_val = 'guest-' . (int) $guest['molongui_id'];

            // Get all post IDs for this guest
            $post_ids = $wpdb->get_col( $wpdb->prepare(
                "SELECT DISTINCT pm.post_id
                 FROM {$wpdb->postmeta} pm
                 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = '_molongui_main_author'
                 AND pm.meta_value = %s
                 AND p.post_type = 'post'
                 AND p.post_status = 'publish'",
                $meta_val
            ) );

            if ( empty( $post_ids ) ) continue;

            $ids_csv = implode( ',', array_map( 'intval', $post_ids ) );

            if ( $has_dates ) {
                $date_where  = '1=1';
                $date_params = [];
                if ( ! empty( $filters['date_from'] ) ) { $date_where .= ' AND s.view_date >= %s'; $date_params[] = $filters['date_from']; }
                if ( ! empty( $filters['date_to']   ) ) { $date_where .= ' AND s.view_date <= %s'; $date_params[] = $filters['date_to']; }

                $views = (int) $wpdb->get_var( $wpdb->prepare(
                    "SELECT COALESCE(SUM(s.pageviews),0)
                     FROM " . self::DB_PREFIX . "popularpostssummary s
                     WHERE s.postid IN ($ids_csv) AND $date_where",
                    ...$date_params
                ) );
            } else {
                $views = (int) $wpdb->get_var(
                    "SELECT COALESCE(SUM(pageviews),0)
                     FROM " . self::DB_PREFIX . "popularpostsdata
                     WHERE postid IN ($ids_csv)"
                );
            }

            $cfg  = $this->get_cost_config( $meta_val );
            $cost = $this->calculate_cost( $cfg, count( $post_ids ), $filters['date_from'], $filters['date_to'] );
            $cpv  = $this->fmt_cpv( $cost, $views );

            $rows[] = [
                'post_author'    => $meta_val,
                'author_name'    => $guest['name'],
                'articles'       => count( $post_ids ),
                'total_views'    => $views,
                'total_cost'     => $cost,
                'cost_label'     => $cfg['type'] === 'monthly' ? '$' . number_format( $cfg['amount'], 0 ) . '/mo' : '$' . number_format( $cfg['amount'], 0 ) . '/story',
                'avg_views'      => count( $post_ids ) > 0 ? round( $views / count( $post_ids ) ) : 0,
                'trend'          => null,
                'cost_per_view'  => $cpv['label'],
                'cpv_val'        => $cpv['val'],
                'is_guest'       => true,
            ];
        }

        return $rows;
    }

    private function get_journalist_summary( array $filters ): array {
        global $wpdb;

        $has_dates = ! empty( $filters['date_from'] ) || ! empty( $filters['date_to'] );
        [ $where, $params ] = $this->build_where( $filters );

        // Exclude hidden journalists
        $hidden = (array) get_option( 'hl_journalist_hidden', [] );
        if ( ! empty( $hidden ) && empty( $filters['author_id'] ) ) {
            $ids_csv  = implode( ',', array_map( 'intval', $hidden ) );
            $where   .= " AND p.post_author NOT IN ($ids_csv)";
        }

        if ( $has_dates ) {
            // Use summary table for date-range filtered views
            $date_where  = "1=1";
            $date_params = [];
            if ( ! empty( $filters['date_from'] ) ) { $date_where .= " AND s.view_date >= %s"; $date_params[] = $filters['date_from']; }
            if ( ! empty( $filters['date_to']   ) ) { $date_where .= " AND s.view_date <= %s"; $date_params[] = $filters['date_to']; }

            $all_params = array_merge( $date_params, $params );

            $sql = "
                SELECT p.post_author, u.display_name AS author_name,
                       COUNT( DISTINCT p.ID ) AS articles,
                       COALESCE( SUM( s.pageviews ), 0 ) AS total_views
                FROM {$wpdb->posts} p
                LEFT JOIN " . self::DB_PREFIX . "popularpostssummary s
                    ON s.postid = p.ID AND $date_where
                LEFT JOIN {$wpdb->users} u ON u.ID = p.post_author
                $where
                GROUP BY p.post_author
                ORDER BY total_views DESC
            ";
        } else {
            // Use aggregated data table for all-time totals (much faster)
            $sql = "
                SELECT p.post_author, u.display_name AS author_name,
                       COUNT( DISTINCT p.ID ) AS articles,
                       COALESCE( SUM( d.pageviews ), 0 ) AS total_views
                FROM {$wpdb->posts} p
                LEFT JOIN " . self::DB_PREFIX . "popularpostsdata d ON d.postid = p.ID
                LEFT JOIN {$wpdb->users} u ON u.ID = p.post_author
                $where
                GROUP BY p.post_author
                ORDER BY total_views DESC
            ";
            $all_params = $params;
        }

        $rows = empty( $all_params )
            ? $wpdb->get_results( $sql, ARRAY_A )
            : $wpdb->get_results( $wpdb->prepare( $sql, ...$all_params ), ARRAY_A );

        // Merge in Molongui guest authors
        $guest_rows = $this->get_molongui_guest_rows( $filters );
        $rows       = array_merge( $rows ?: [], $guest_rows );
        usort( $rows, function( $a, $b ) { return (int)$b['total_views'] - (int)$a['total_views']; } );

        // Previous period for trend
        $prev = $this->get_prev_period_views( $filters );

        foreach ( $rows as &$r ) {
            $cfg                = $this->get_cost_config( (int)$r['post_author'] );
            $cost               = $this->calculate_cost( $cfg, (int)$r['articles'], $filters['date_from'], $filters['date_to'] );
            $r['total_cost']    = $cost;
            $r['cost_label']    = $cfg['type'] === 'monthly' ? '$' . number_format( $cfg['amount'], 0 ) . '/mo' : '$' . number_format( $cfg['amount'], 0 ) . '/story';
            $r['avg_views']     = $r['articles'] > 0 ? round( $r['total_views'] / $r['articles'] ) : 0;
            $prev_views         = $prev[ $r['post_author'] ] ?? 0;
            $r['trend']         = $prev_views > 0 ? round( ( ( $r['total_views'] - $prev_views ) / $prev_views ) * 100 ) : null;
            $cpv                = $this->fmt_cpv( $cost, (int)$r['total_views'] );
            $r['cost_per_view'] = $cpv['label'];
            $r['cpv_val']       = $cpv['val'];
        }

        return $rows;
    }

    // -------------------------------------------------------------------------
    // Previous period views (for trend)
    // -------------------------------------------------------------------------

    private function get_prev_period_views( array $filters ): array {
        global $wpdb;
        if ( empty( $filters['date_from'] ) || empty( $filters['date_to'] ) ) return [];

        $from      = new DateTime( $filters['date_from'] );
        $to        = new DateTime( $filters['date_to'] );
        $days      = $from->diff( $to )->days + 1;
        $prev_to   = (clone $from)->modify( '-1 day' )->format( 'Y-m-d' );
        $prev_from = (clone $from)->modify( "-{$days} days" )->format( 'Y-m-d' );

        $sql  = $wpdb->prepare(
            "SELECT p.post_author, COALESCE(SUM(s.pageviews),0) AS views
             FROM {$wpdb->posts} p
             LEFT JOIN " . self::DB_PREFIX . "popularpostssummary s
                 ON s.postid=p.ID AND s.view_date>=%s AND s.view_date<=%s
             WHERE p.post_type='post' AND p.post_status='publish'
             GROUP BY p.post_author",
            $prev_from, $prev_to
        );

        $out = [];
        foreach ( $wpdb->get_results( $sql, ARRAY_A ) as $r ) $out[ $r['post_author'] ] = (int)$r['views'];
        return $out;
    }

    // -------------------------------------------------------------------------
    // Monthly breakdown — from summary table
    // -------------------------------------------------------------------------

    private function get_monthly_breakdown( array $filters ): array {
        global $wpdb;
        [ $where, $params ] = $this->build_where( $filters );

        $date_where  = "1=1";
        $date_params = [];
        if ( ! empty( $filters['date_from'] ) ) { $date_where .= " AND s.view_date>=%s"; $date_params[] = $filters['date_from']; }
        if ( ! empty( $filters['date_to']   ) ) { $date_where .= " AND s.view_date<=%s"; $date_params[] = $filters['date_to']; }

        $sql  = $wpdb->prepare(
            "SELECT p.post_author, u.display_name AS author_name,
                    DATE_FORMAT(s.view_date,'%Y-%m') AS period,
                    COUNT(DISTINCT p.ID) AS articles,
                    COALESCE(SUM(s.pageviews),0) AS views
             FROM {$wpdb->posts} p
             INNER JOIN " . self::DB_PREFIX . "popularpostssummary s ON s.postid=p.ID AND $date_where
             LEFT JOIN {$wpdb->users} u ON u.ID=p.post_author
             $where
             GROUP BY p.post_author, period
             ORDER BY p.post_author, period DESC",
            ...array_merge( $date_params, $params )
        );

        $out = [];
        foreach ( $wpdb->get_results( $sql, ARRAY_A ) as $r ) {
            $cfg  = $this->get_cost_config( (int)$r['post_author'] );
            $cost = $cfg['type'] === 'per_story' ? (int)$r['articles'] * $cfg['amount'] : $cfg['amount'];
            $cpv  = $this->fmt_cpv( $cost, (int)$r['views'] );
            $out[ $r['author_name'] ][] = [
                'period'   => DateTime::createFromFormat( 'Y-m', $r['period'] )->format( 'M Y' ),
                'articles' => $r['articles'],
                'views'    => $r['views'],
                'cost'     => $cost,
                'cpv'      => $cpv['label'],
                'cpv_val'  => $cpv['val'],
            ];
        }
        return $out;
    }

    // -------------------------------------------------------------------------
    // Weekly breakdown — from summary table
    // -------------------------------------------------------------------------

    private function get_weekly_breakdown( array $filters ): array {
        global $wpdb;
        [ $where, $params ] = $this->build_where( $filters );

        $date_where  = "1=1";
        $date_params = [];
        if ( ! empty( $filters['date_from'] ) ) { $date_where .= " AND s.view_date>=%s"; $date_params[] = $filters['date_from']; }
        if ( ! empty( $filters['date_to']   ) ) { $date_where .= " AND s.view_date<=%s"; $date_params[] = $filters['date_to']; }

        $sql  = $wpdb->prepare(
            "SELECT p.post_author, u.display_name AS author_name,
                    YEARWEEK(s.view_date,1) AS yw,
                    MIN(s.view_date) AS week_start,
                    COUNT(DISTINCT p.ID) AS articles,
                    COALESCE(SUM(s.pageviews),0) AS views
             FROM {$wpdb->posts} p
             INNER JOIN " . self::DB_PREFIX . "popularpostssummary s ON s.postid=p.ID AND $date_where
             LEFT JOIN {$wpdb->users} u ON u.ID=p.post_author
             $where
             GROUP BY p.post_author, yw
             ORDER BY p.post_author, yw DESC",
            ...array_merge( $date_params, $params )
        );

        $out = [];
        foreach ( $wpdb->get_results( $sql, ARRAY_A ) as $r ) {
            $cfg  = $this->get_cost_config( (int)$r['post_author'] );
            $cost = $cfg['type'] === 'per_story' ? (int)$r['articles'] * $cfg['amount'] : round( $cfg['amount'] / 4.33, 2 );
            $cpv  = $this->fmt_cpv( $cost, (int)$r['views'] );
            $out[ $r['author_name'] ][] = [
                'period'   => 'w/c ' . date( 'd M Y', strtotime( $r['week_start'] ) ),
                'articles' => $r['articles'],
                'views'    => $r['views'],
                'cost'     => $cost,
                'cpv'      => $cpv['label'],
                'cpv_val'  => $cpv['val'],
            ];
        }
        return $out;
    }

    // -------------------------------------------------------------------------
    // Totals
    // -------------------------------------------------------------------------

    private function get_totals( array $filters ): array {
        global $wpdb;
        $has_dates = ! empty( $filters['date_from'] ) || ! empty( $filters['date_to'] );
        [ $where, $params ] = $this->build_where( $filters );

        if ( $has_dates ) {
            $date_where  = "1=1";
            $date_params = [];
            if ( ! empty( $filters['date_from'] ) ) { $date_where .= " AND s.view_date>=%s"; $date_params[] = $filters['date_from']; }
            if ( ! empty( $filters['date_to']   ) ) { $date_where .= " AND s.view_date<=%s"; $date_params[] = $filters['date_to']; }
            $sql = "SELECT COUNT(DISTINCT p.ID) AS total_posts, COALESCE(SUM(s.pageviews),0) AS total_views
                    FROM {$wpdb->posts} p
                    LEFT JOIN " . self::DB_PREFIX . "popularpostssummary s ON s.postid=p.ID AND $date_where
                    $where";
            $all_params = array_merge( $date_params, $params );
        } else {
            $sql = "SELECT COUNT(DISTINCT p.ID) AS total_posts, COALESCE(SUM(d.pageviews),0) AS total_views
                    FROM {$wpdb->posts} p
                    LEFT JOIN " . self::DB_PREFIX . "popularpostsdata d ON d.postid=p.ID
                    $where";
            $all_params = $params;
        }

        return ( empty( $all_params )
            ? $wpdb->get_row( $sql, ARRAY_A )
            : $wpdb->get_row( $wpdb->prepare( $sql, ...$all_params ), ARRAY_A ) )
            ?: [ 'total_posts' => 0, 'total_views' => 0 ];
    }

    // -------------------------------------------------------------------------
    // Articles (paginated) — views from popularpostsdata (all-time) or summary (date filtered)
    // -------------------------------------------------------------------------

    private function get_articles( array $filters, int $page ): array {
        global $wpdb;
        $has_dates = ! empty( $filters['date_from'] ) || ! empty( $filters['date_to'] );
        [ $where, $params ] = $this->build_where( $filters );
        $offset = ( $page - 1 ) * self::POSTS_PER_PAGE;

        if ( $has_dates ) {
            $date_where  = "1=1";
            $date_params = [];
            if ( ! empty( $filters['date_from'] ) ) { $date_where .= " AND s.view_date>=%s"; $date_params[] = $filters['date_from']; }
            if ( ! empty( $filters['date_to']   ) ) { $date_where .= " AND s.view_date<=%s"; $date_params[] = $filters['date_to']; }

            $count_sql  = "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p LEFT JOIN " . self::DB_PREFIX . "popularpostssummary s ON s.postid=p.ID AND $date_where $where";
            $count_params = array_merge( $date_params, $params );
            $total      = (int)$wpdb->get_var( $wpdb->prepare( $count_sql, ...$count_params ) );

            $sql_params = array_merge( $date_params, $params, [ self::POSTS_PER_PAGE, $offset ] );
            $sql = "SELECT p.ID, p.post_title, p.post_date, p.post_author, u.display_name AS author_name,
                           COALESCE(SUM(s.pageviews),0) AS views
                    FROM {$wpdb->posts} p
                    LEFT JOIN " . self::DB_PREFIX . "popularpostssummary s ON s.postid=p.ID AND $date_where
                    LEFT JOIN {$wpdb->users} u ON u.ID=p.post_author
                    $where
                    GROUP BY p.ID ORDER BY views DESC LIMIT %d OFFSET %d";
        } else {
            $count_sql    = "SELECT COUNT(*) FROM {$wpdb->posts} p $where";
            $total        = empty( $params ) ? (int)$wpdb->get_var( $count_sql ) : (int)$wpdb->get_var( $wpdb->prepare( $count_sql, ...$params ) );
            $sql_params   = array_merge( $params, [ self::POSTS_PER_PAGE, $offset ] );
            $sql = "SELECT p.ID, p.post_title, p.post_date, p.post_author, u.display_name AS author_name,
                           COALESCE(d.pageviews,0) AS views
                    FROM {$wpdb->posts} p
                    LEFT JOIN " . self::DB_PREFIX . "popularpostsdata d ON d.postid=p.ID
                    LEFT JOIN {$wpdb->users} u ON u.ID=p.post_author
                    $where ORDER BY views DESC LIMIT %d OFFSET %d";
        }

        $rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$sql_params ), ARRAY_A );

        foreach ( $rows as &$r ) {
            $cfg            = $this->get_cost_config( (int)$r['post_author'] );
            $story_cost     = $cfg['type'] === 'per_story' ? $cfg['amount'] : round( $cfg['amount'] / 4.33, 2 );
            $cpv            = $this->fmt_cpv( $story_cost, (int)$r['views'] );
            $r['story_cost']    = $story_cost;
            $r['cost_per_view'] = $cpv['label'];
            $r['cpv_val']       = $cpv['val'];
        }

        return [ 'rows' => $rows, 'total' => $total ];
    }

    // -------------------------------------------------------------------------
    // CSV export
    // -------------------------------------------------------------------------

    public function maybe_export_csv() {
        if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'hl-journalist-stats' ) return;
        if ( ! isset( $_GET['export'] ) ) return;
        if ( ! current_user_can( 'manage_options' ) ) return;
        check_admin_referer( 'hl_stats_export' );

        $export  = sanitize_text_field( $_GET['export'] );
        $filters = $this->get_filters();

        header( 'Content-Type: text/csv' );
        header( 'Content-Disposition: attachment; filename="harnesslink-stats-' . $export . '-' . date( 'Y-m-d' ) . '.csv"' );
        $out = fopen( 'php://output', 'w' );

        if ( $export === 'journalists' ) {
            fputcsv( $out, [ 'Journalist', 'Rate', 'Articles', 'Total Views', 'Avg Views/Article', 'Total Cost', 'Cost Per View', 'Trend' ] );
            foreach ( $this->get_journalist_summary( $filters ) as $j ) {
                $trend = $j['trend'] !== null ? ( $j['trend'] >= 0 ? '+' . $j['trend'] . '%' : $j['trend'] . '%' ) : 'N/A';
                fputcsv( $out, [ $j['author_name'], $j['cost_label'], $j['articles'], $j['total_views'], $j['avg_views'], '$' . number_format( $j['total_cost'], 2 ), $j['cost_per_view'], $trend ] );
            }
        } elseif ( $export === 'monthly' ) {
            fputcsv( $out, [ 'Journalist', 'Month', 'Articles', 'Views', 'Cost', 'Cost Per View' ] );
            foreach ( $this->get_monthly_breakdown( $filters ) as $name => $months )
                foreach ( $months as $m ) fputcsv( $out, [ $name, $m['period'], $m['articles'], $m['views'], '$' . number_format( $m['cost'], 2 ), $m['cpv'] ] );
        } elseif ( $export === 'weekly' ) {
            fputcsv( $out, [ 'Journalist', 'Week', 'Articles', 'Views', 'Cost', 'Cost Per View' ] );
            foreach ( $this->get_weekly_breakdown( $filters ) as $name => $weeks )
                foreach ( $weeks as $w ) fputcsv( $out, [ $name, $w['period'], $w['articles'], $w['views'], '$' . number_format( $w['cost'], 2 ), $w['cpv'] ] );
        } elseif ( $export === 'articles' ) {
            fputcsv( $out, [ 'Article', 'Journalist', 'Date', 'Views', 'Story Cost', 'Cost Per View' ] );
            $page = 1;
            do {
                $result = $this->get_articles( $filters, $page );
                foreach ( $result['rows'] as $r ) fputcsv( $out, [ $r['post_title'], $r['author_name'], date( 'd M Y', strtotime( $r['post_date'] ) ), $r['views'], '$' . number_format( $r['story_cost'], 2 ), $r['cost_per_view'] ] );
                $page++;
            } while ( ( $page - 1 ) * self::POSTS_PER_PAGE < $result['total'] );
        } elseif ( $export === 'categories' ) {
            fputcsv( $out, [ 'Category', 'Stories', 'Avg / Day', 'Avg / Week' ] );
            foreach ( $this->get_category_summary( $filters ) as $c )
                fputcsv( $out, [ $c['term_name'], $c['stories'], $c['avg_day'], $c['avg_week'] ] );
        } elseif ( $export === 'output_daily' || $export === 'output_weekly' ) {
            $granularity = $export === 'output_weekly' ? 'week' : 'day';
            $periods     = $this->get_output_periods( $filters, $granularity );
            $cats        = $this->get_category_summary( $filters );
            $col_terms   = array_slice( $cats, 0, self::MAX_CAT_COLS );
            $matrix      = $this->get_output_matrix( $filters, $granularity );

            $header = [ $granularity === 'week' ? 'Week' : 'Day', 'Total Stories' ];
            foreach ( $col_terms as $t ) $header[] = $t['term_name'];
            $header[] = 'Other';
            fputcsv( $out, $header );

            foreach ( $periods as $p ) {
                $row      = [ $p['label'], $p['stories'] ];
                $counted  = 0;
                $pk_cells = $matrix[ $p['pk'] ] ?? [];
                foreach ( $col_terms as $t ) {
                    $val = $pk_cells[ $t['term_id'] ] ?? 0;
                    $row[] = $val;
                    $counted += $val;
                }
                $row[] = array_sum( $pk_cells ) - $counted; // Other
                fputcsv( $out, $row );
            }
        }

        fclose( $out ); exit;
    }

    // -------------------------------------------------------------------------
    // Filters
    // -------------------------------------------------------------------------

    private function get_filters(): array {
        return [
            'author_id' => isset( $_GET['author_id'] ) ? intval( $_GET['author_id'] ) : 0,
            'term_id'   => isset( $_GET['term_id'] )   ? intval( $_GET['term_id'] )   : 0,
            'date_from' => isset( $_GET['date_from'] ) ? sanitize_text_field( $_GET['date_from'] ) : '',
            'date_to'   => isset( $_GET['date_to'] )   ? sanitize_text_field( $_GET['date_to'] )   : '',
        ];
    }

    // -------------------------------------------------------------------------
    // Costs / settings page
    // -------------------------------------------------------------------------

    public function render_costs_page() {
        $authors = get_users( [ 'role__in' => [ 'administrator', 'editor', 'author', 'contributor' ] ] );
        if ( isset( $_POST['hl_costs_nonce'] ) && wp_verify_nonce( $_POST['hl_costs_nonce'], 'hl_save_costs' ) ) {
            // Save PIN
            $pin = preg_replace( '/\D/', '', $_POST['hl_pin'] ?? '' );
            if ( strlen( $pin ) === 4 ) update_option( 'hl_stats_pin', $pin );
            // Save category taxonomy
            if ( isset( $_POST['hl_stats_taxonomy'] ) ) {
                $tax = sanitize_key( $_POST['hl_stats_taxonomy'] );
                if ( taxonomy_exists( $tax ) ) update_option( 'hl_stats_taxonomy', $tax );
            }
            // Save costs
            $costs = [];
            foreach ( $authors as $a )
                $costs[ $a->ID ] = [ 'type' => sanitize_text_field( $_POST['cost_type'][ $a->ID ] ?? 'per_story' ), 'amount' => floatval( $_POST['cost_amount'][ $a->ID ] ?? 100 ) ];
            update_option( 'hl_journalist_costs', $costs );
            // Save hidden journalists
            $hidden = isset( $_POST['journalist_hidden'] ) ? array_map( 'intval', (array) $_POST['journalist_hidden'] ) : [];
            update_option( 'hl_journalist_hidden', $hidden );
            // Save Molongui guests
            $guests     = [];
            $g_names    = array_map( 'sanitize_text_field', (array) ( $_POST['molongui_guest_name']   ?? [] ) );
            $g_ids      = array_map( 'intval',              (array) ( $_POST['molongui_guest_id']     ?? [] ) );
            $g_types    = (array) ( $_POST['molongui_guest_cost_type']   ?? [] );
            $g_amounts  = (array) ( $_POST['molongui_guest_cost_amount'] ?? [] );
            foreach ( $g_names as $i => $gname ) {
                if ( ! $gname || empty( $g_ids[ $i ] ) ) continue;
                $mid      = $g_ids[ $i ];
                $meta_val = 'guest-' . $mid;
                $guests[] = [ 'name' => $gname, 'molongui_id' => $mid ];
                $costs[ $meta_val ] = [
                    'type'   => sanitize_text_field( $g_types[ $i ]   ?? 'per_story' ),
                    'amount' => floatval( $g_amounts[ $i ] ?? 100 ),
                ];
            }
            update_option( 'hl_molongui_guests', $guests );
            update_option( 'hl_journalist_costs', $costs ); // re-save with guest costs merged in
            echo '<div class="notice notice-success"><p>Saved.</p></div>';
        }
        $costs      = get_option( 'hl_journalist_costs', [] );
        $hidden     = (array) get_option( 'hl_journalist_hidden', [] );
        $pin        = $this->get_pin();
        $tax_choice = $this->get_taxonomy();
        $taxes      = get_taxonomies( [ 'public' => true ], 'objects' );
        ?>
        <div class="wrap hl-stats-wrap">
            <h1>Journalist Cost Settings</h1>

            <form method="post">
                <?php wp_nonce_field( 'hl_save_costs', 'hl_costs_nonce' ); ?>

                <h2 style="font-size:14px;margin-bottom:6px;">🔒 Dashboard PIN</h2>
                <p class="description" style="margin-bottom:10px;">4-digit PIN required to view the stats dashboard. Default: <code>1234</code>.</p>
                <p>
                    <input type="password" name="hl_pin" id="hl-pin-input" value="<?php echo esc_attr( $pin ); ?>"
                           maxlength="4" pattern="\d{4}" style="font-size:20px;letter-spacing:.3em;width:90px;text-align:center;" autocomplete="off">
                    &nbsp;<button type="button" onclick="var f=document.getElementById('hl-pin-input');f.type=f.type==='password'?'text':'password';">Show/Hide</button>
                    &nbsp;<span class="description">Must be 4 digits.</span>
                </p>

                <h2 style="font-size:14px;margin:20px 0 6px;">🌐 Category taxonomy</h2>
                <p class="description" style="margin-bottom:10px;">Which taxonomy holds your geographic categories (USA, AU, …). Used by the <strong>Stories / Day</strong>, <strong>Stories / Week</strong> and <strong>By Category</strong> tabs.</p>
                <p>
                    <select name="hl_stats_taxonomy">
                        <?php foreach ( $taxes as $tx ) : ?>
                        <option value="<?php echo esc_attr( $tx->name ); ?>" <?php selected( $tax_choice, $tx->name ); ?>>
                            <?php echo esc_html( $tx->labels->singular_name . ' (' . $tx->name . ')' ); ?>
                        </option>
                        <?php endforeach; ?>
                    </select>
                </p>

                <h2 style="font-size:14px;margin:20px 0 6px;">👥 Journalist Rates &amp; Visibility</h2>
                <p class="description" style="margin-bottom:10px;">Untick <strong>Show in Dashboard</strong> to hide a user from the stats without deleting their data.</p>
                <table class="wp-list-table widefat fixed striped">
                    <thead><tr><th>Journalist</th><th>Payment Type</th><th>Amount ($)</th><th style="width:130px;text-align:center;">Show in Dashboard</th></tr></thead>
                    <tbody>
                    <?php foreach ( $authors as $a ) :
                        $cfg        = $costs[ $a->ID ] ?? [ 'type' => 'per_story', 'amount' => 100 ];
                        $is_hidden  = in_array( $a->ID, $hidden, true ); ?>
                    <tr>
                        <td><strong><?php echo esc_html( $a->display_name ); ?></strong><br><small><?php echo esc_html( $a->user_email ); ?></small></td>
                        <td>
                            <label><input type="radio" name="cost_type[<?php echo $a->ID; ?>]" value="monthly" <?php checked( $cfg['type'], 'monthly' ); ?>> Monthly retainer</label>&nbsp;&nbsp;
                            <label><input type="radio" name="cost_type[<?php echo $a->ID; ?>]" value="per_story" <?php checked( $cfg['type'], 'per_story' ); ?>> Per story</label>
                        </td>
                        <td>$ <input type="number" name="cost_amount[<?php echo $a->ID; ?>]" value="<?php echo esc_attr( $cfg['amount'] ); ?>" min="0" step="0.01" style="width:100px;"></td>
                        <td style="text-align:center;">
                            <input type="checkbox" name="journalist_hidden[]" value="<?php echo $a->ID; ?>" <?php checked( $is_hidden ); ?> title="Tick to hide from dashboard">
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <h2 style="font-size:14px;margin:24px 0 6px;">🎙️ Molongui Guest Authors</h2>
                <p class="description" style="margin-bottom:10px;">
                    Add guest authors managed by Molongui. Find their ID in WP Admin → Users (the number shown on the right, e.g. <code>2117100</code>).
                    Their posts are matched via <code>_molongui_main_author = guest-ID</code>.
                </p>
                <table class="wp-list-table widefat fixed striped" id="hl-molongui-table">
                    <thead><tr><th>Name</th><th style="width:140px;">Molongui ID</th><th>Payment Type</th><th style="width:140px;">Amount ($)</th><th style="width:60px;"></th></tr></thead>
                    <tbody id="hl-molongui-body">
                    <?php
                    $mg_guests = $this->get_molongui_guests();
                    $mg_costs  = get_option( 'hl_journalist_costs', [] );
                    foreach ( $mg_guests as $gi => $g ) :
                        $gkey = 'guest-' . $g['molongui_id'];
                        $gcfg = $mg_costs[ $gkey ] ?? [ 'type' => 'per_story', 'amount' => 100 ];
                    ?>
                    <tr class="hl-mg-row">
                        <td><input type="text" name="molongui_guest_name[]" value="<?php echo esc_attr( $g['name'] ); ?>" class="regular-text" required></td>
                        <td><input type="number" name="molongui_guest_id[]" value="<?php echo esc_attr( $g['molongui_id'] ); ?>" class="small-text" required></td>
                        <td>
                            <label><input type="radio" name="molongui_guest_cost_type[<?php echo $gi; ?>]" value="monthly"   <?php checked( $gcfg['type'], 'monthly' ); ?>> Monthly</label>&nbsp;
                            <label><input type="radio" name="molongui_guest_cost_type[<?php echo $gi; ?>]" value="per_story" <?php checked( $gcfg['type'], 'per_story' ); ?>> Per story</label>
                        </td>
                        <td>$ <input type="number" name="molongui_guest_cost_amount[<?php echo $gi; ?>]" value="<?php echo esc_attr( $gcfg['amount'] ); ?>" min="0" step="0.01" style="width:80px;"></td>
                        <td><button type="button" class="button hl-mg-remove">✕</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button" id="hl-mg-add">+ Add Molongui Guest</button></p>

                <script>
                var mgIdx = <?php echo count( $mg_guests ); ?>;
                document.getElementById('hl-mg-add').addEventListener('click', function() {
                    var i = mgIdx++;
                    var tr = document.createElement('tr');
                    tr.className = 'hl-mg-row';
                    tr.innerHTML =
                        '<td><input type="text" name="molongui_guest_name[]" class="regular-text" placeholder="Guest Name" required></td>' +
                        '<td><input type="number" name="molongui_guest_id[]" class="small-text" placeholder="e.g. 2117100" required></td>' +
                        '<td><label><input type="radio" name="molongui_guest_cost_type['+i+']" value="monthly"> Monthly</label>&nbsp;' +
                            '<label><input type="radio" name="molongui_guest_cost_type['+i+']" value="per_story" checked> Per story</label></td>' +
                        '<td>$ <input type="number" name="molongui_guest_cost_amount['+i+']" value="100" min="0" step="0.01" style="width:80px;"></td>' +
                        '<td><button type="button" class="button hl-mg-remove">✕</button></td>';
                    document.getElementById('hl-molongui-body').appendChild(tr);
                    tr.querySelector('.hl-mg-remove').addEventListener('click', function(){ this.closest('tr').remove(); });
                });
                document.querySelectorAll('.hl-mg-remove').forEach(function(b){
                    b.addEventListener('click', function(){ this.closest('tr').remove(); });
                });
                </script>

                <?php submit_button( 'Save settings' ); ?>
            </form>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // Main dashboard
    // -------------------------------------------------------------------------

    public function render_page() {
        $this->start_session();
        if ( ! $this->is_unlocked() ) {
            $this->render_pin_screen();
            return;
        }
        $filters     = $this->get_filters();
        $totals      = $this->get_totals( $filters );
        $summary     = $this->get_journalist_summary( $filters );
        $cur_page    = isset( $_GET['paged'] ) ? max( 1, intval( $_GET['paged'] ) ) : 1;
        $view_tab    = isset( $_GET['tab'] ) ? sanitize_text_field( $_GET['tab'] ) : 'out_daily';
        $total_cost  = array_sum( array_column( $summary, 'total_cost' ) );
        $avg_views   = $totals['total_posts'] > 0 ? round( $totals['total_views'] / $totals['total_posts'] ) : 0;
        $cpv_float   = $totals['total_views'] > 0 ? $total_cost / $totals['total_views'] : 999;
        $overall_cpv = $totals['total_views'] > 0 ? '$' . number_format( $cpv_float, 2 ) : 'N/A';

        // Output averages (story counts, independent of views)
        $range_days  = $this->get_range_days( $filters );
        $avg_day     = $range_days > 0 ? round( $totals['total_posts'] / $range_days, 1 ) : 0;
        $avg_week    = $range_days > 0 ? round( $totals['total_posts'] / ( $range_days / 7 ), 1 ) : 0;

        $authors      = get_users( [ 'role__in' => [ 'administrator', 'editor', 'author', 'contributor' ] ] );
        $terms        = $this->get_all_terms();
        $tax_obj      = get_taxonomy( $this->get_taxonomy() );
        $tax_label    = $tax_obj ? $tax_obj->labels->singular_name : 'Category';
        $export_nonce = wp_create_nonce( 'hl_stats_export' );
        $base_url     = admin_url( 'admin.php?page=hl-journalist-stats' );
        $qargs        = array_filter( $filters );

        $presets = [
            'this_week'    => [ 'label' => 'This Week',     'from' => date( 'Y-m-d', strtotime( 'monday this week' ) ),          'to' => date( 'Y-m-d' ) ],
            'last_week'    => [ 'label' => 'Last Week',     'from' => date( 'Y-m-d', strtotime( 'monday last week' ) ),          'to' => date( 'Y-m-d', strtotime( 'sunday last week' ) ) ],
            'this_month'   => [ 'label' => 'This Month',    'from' => date( 'Y-m-01' ),                                           'to' => date( 'Y-m-d' ) ],
            'last_month'   => [ 'label' => 'Last Month',    'from' => date( 'Y-m-01', strtotime( 'first day of last month' ) ),  'to' => date( 'Y-m-t', strtotime( 'last day of last month' ) ) ],
            'last_3months' => [ 'label' => 'Last 3 Months', 'from' => date( 'Y-m-01', strtotime( '-2 months' ) ),                'to' => date( 'Y-m-d' ) ],
            'this_year'    => [ 'label' => 'This Year',     'from' => date( 'Y-01-01' ),                                         'to' => date( 'Y-m-d' ) ],
        ];
        ?>
        <div class="wrap hl-stats-wrap">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                <div><h1>📊 Journalist Stats</h1></div>
                <button type="button" id="hl-lock-btn" class="button" style="margin-top:10px;">🔒 Lock</button>
            </div>
            <p class="description">Story output &amp; views &nbsp;·&nbsp; <a href="<?php echo admin_url( 'admin.php?page=hl-journalist-costs' ); ?>">Settings &amp; journalist rates →</a></p>

            <!-- Journalist filter dropdown + preset buttons -->
            <div class="hl-top-bar">
                <div class="hl-presets">
                    <?php foreach ( $presets as $p ) :
                        $active = $filters['date_from'] === $p['from'] && $filters['date_to'] === $p['to'];
                        $url    = add_query_arg( array_merge( $qargs, [ 'page' => 'hl-journalist-stats', 'tab' => $view_tab, 'date_from' => $p['from'], 'date_to' => $p['to'] ] ), admin_url( 'admin.php' ) );
                    ?>
                    <a href="<?php echo esc_url( $url ); ?>" class="hl-preset-btn<?php echo $active ? ' active' : ''; ?>"><?php echo $p['label']; ?></a>
                    <?php endforeach; ?>
                    <?php $alltime = array_merge( $qargs, [ 'page' => 'hl-journalist-stats', 'tab' => $view_tab ] ); unset( $alltime['date_from'], $alltime['date_to'] ); ?>
                    <a href="<?php echo esc_url( add_query_arg( $alltime, admin_url( 'admin.php' ) ) ); ?>" class="hl-preset-btn<?php echo empty( $filters['date_from'] ) && empty( $filters['date_to'] ) ? ' active' : ''; ?>">All Time</a>
                </div>

                <form method="get" class="hl-inline-filter">
                    <input type="hidden" name="page" value="hl-journalist-stats"/>
                    <input type="hidden" name="tab" value="<?php echo esc_attr( $view_tab ); ?>"/>
                    <select name="author_id" onchange="this.form.submit()">
                        <option value="">All journalists</option>
                        <?php foreach ( $authors as $a ) : ?>
                        <option value="<?php echo $a->ID; ?>" <?php selected( $filters['author_id'], $a->ID ); ?>><?php echo esc_html( $a->display_name ); ?></option>
                        <?php endforeach; ?>
                    </select>
                    <select name="term_id" onchange="this.form.submit()">
                        <option value="">All <?php echo esc_html( $tax_label ); ?></option>
                        <?php foreach ( $terms as $t ) : ?>
                        <option value="<?php echo $t->term_id; ?>" <?php selected( $filters['term_id'], $t->term_id ); ?>><?php echo esc_html( $t->name ); ?> (<?php echo (int) $t->count; ?>)</option>
                        <?php endforeach; ?>
                    </select>
                    <label>From <input type="date" name="date_from" value="<?php echo esc_attr( $filters['date_from'] ); ?>"/></label>
                    <label>To   <input type="date" name="date_to"   value="<?php echo esc_attr( $filters['date_to'] ); ?>"/></label>
                    <button type="submit" class="button button-primary">Filter</button>
                    <a href="<?php echo esc_url( add_query_arg( [ 'page' => 'hl-journalist-stats', 'tab' => $view_tab ], admin_url( 'admin.php' ) ) ); ?>" class="button">Reset</a>
                </form>
            </div>

            <!-- Summary cards -->
            <div class="hl-cards">
                <div class="hl-card"><div class="hl-card-value"><?php echo number_format( $totals['total_posts'] ); ?></div><div class="hl-card-label">Stories Published</div></div>
                <div class="hl-card"><div class="hl-card-value"><?php echo number_format( $avg_day, 1 ); ?></div><div class="hl-card-label">Avg Stories / Day</div></div>
                <div class="hl-card"><div class="hl-card-value"><?php echo number_format( $avg_week, 1 ); ?></div><div class="hl-card-label">Avg Stories / Week</div></div>
                <div class="hl-card"><div class="hl-card-value"><?php echo number_format( $totals['total_views'] ); ?></div><div class="hl-card-label">Total Views</div></div>
                <div class="hl-card"><div class="hl-card-value"><?php echo number_format( $avg_views ); ?></div><div class="hl-card-label">Avg Views / Article</div></div>
                <div class="hl-card"><div class="hl-card-value">$<?php echo number_format( $total_cost ); ?></div><div class="hl-card-label">Total Cost</div></div>
                <div class="hl-card <?php echo $cpv_float < 0.10 ? 'hl-card-good' : ( $cpv_float > 0.50 ? 'hl-card-bad' : '' ); ?>">
                    <div class="hl-card-value"><?php echo $overall_cpv; ?></div><div class="hl-card-label">Overall Cost / View</div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="hl-tabs">
                <?php
                $tabs = [
                    'out_daily'  => 'Stories / Day',
                    'out_weekly' => 'Stories / Week',
                    'categories' => 'By ' . $tax_label,
                    'summary'    => 'By Journalist',
                    'monthly'    => 'Views · Monthly',
                    'weekly'     => 'Views · Weekly',
                    'articles'   => 'All Articles',
                ];
                foreach ( $tabs as $key => $label ) :
                    $tab_url = add_query_arg( array_merge( $qargs, [ 'tab' => $key ] ), $base_url );
                ?>
                <a href="<?php echo esc_url( $tab_url ); ?>" class="hl-tab<?php echo $view_tab === $key ? ' active' : ''; ?>"><?php echo esc_html( $label ); ?></a>
                <?php endforeach; ?>
            </div>

            <?php
            // ── NEW: Stories per Day / Week (with category breakdown) ──
            if ( $view_tab === 'out_daily' || $view_tab === 'out_weekly' ) :
                $granularity = $view_tab === 'out_weekly' ? 'week' : 'day';
                $this->render_output_matrix( $filters, $granularity, $tax_label, $qargs, $base_url, $export_nonce, $range_days );

            // ── NEW: By Category ──
            elseif ( $view_tab === 'categories' ) :
                $cats = $this->get_category_summary( $filters );
                $top  = $cats[0]['stories'] ?? 0;
            ?>
            <div class="hl-section">
                <div class="hl-section-header">
                    <span class="hl-count"><?php echo count( $cats ); ?> <?php echo esc_html( strtolower( $tax_label ) ); ?> categories</span>
                    <a href="<?php echo esc_url( add_query_arg( array_merge( $qargs, [ 'export' => 'categories', '_wpnonce' => $export_nonce ] ), $base_url ) ); ?>" class="button">⬇ Export CSV</a>
                </div>
                <table class="wp-list-table widefat fixed striped">
                    <thead><tr>
                        <th><?php echo esc_html( $tax_label ); ?></th>
                        <th class="num">Stories</th><th class="num">Share</th>
                        <th class="num">Avg / Day</th><th class="num">Avg / Week</th>
                    </tr></thead>
                    <tbody>
                    <?php if ( empty( $cats ) ) : ?><tr><td colspan="5">No stories found for this taxonomy in the selected range.</td></tr>
                    <?php else : foreach ( $cats as $c ) :
                        $cat_url = add_query_arg( array_merge( $qargs, [ 'term_id' => $c['term_id'], 'tab' => 'out_daily' ] ), $base_url ); ?>
                    <tr>
                        <td><strong><a href="<?php echo esc_url( $cat_url ); ?>"><?php echo esc_html( $c['term_name'] ); ?></a></strong><div class="hl-bar-wrap"><div class="hl-bar" style="width:<?php echo $c['bar']; ?>%"></div></div></td>
                        <td class="num"><strong><?php echo number_format( $c['stories'] ); ?></strong></td>
                        <td class="num"><?php echo $totals['total_posts'] > 0 ? round( ( $c['stories'] / $totals['total_posts'] ) * 100 ) : 0; ?>%</td>
                        <td class="num"><?php echo number_format( $c['avg_day'], 2 ); ?></td>
                        <td class="num"><?php echo number_format( $c['avg_week'], 1 ); ?></td>
                    </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
                <p class="hl-note">💡 A story tagged in more than one <?php echo esc_html( strtolower( $tax_label ) ); ?> is counted under each, so category totals can exceed “Stories Published”. Share is vs. distinct stories.</p>
            </div>

            <!-- TAB: By Journalist -->
            <?php elseif ( $view_tab === 'summary' ) : ?>
            <div class="hl-section">
                <div class="hl-section-header">
                    <span></span>
                    <a href="<?php echo esc_url( add_query_arg( array_merge( $qargs, [ 'export' => 'journalists', '_wpnonce' => $export_nonce ] ), $base_url ) ); ?>" class="button">⬇ Export CSV</a>
                </div>
                <table class="wp-list-table widefat fixed striped">
                    <thead><tr>
                        <th>Journalist</th><th class="num">Rate</th><th class="num">Articles</th>
                        <th class="num">Total Views</th><th class="num">Avg Views/Article</th>
                        <th class="num">Total Cost</th><th class="num cpv-col">Cost/View</th><th class="num">Trend</th>
                    </tr></thead>
                    <tbody>
                    <?php if ( empty( $summary ) ) : ?><tr><td colspan="8">No data found.</td></tr>
                    <?php else : foreach ( $summary as $j ) :
                        $bar      = $summary[0]['total_views'] > 0 ? round( ( $j['total_views'] / $summary[0]['total_views'] ) * 100 ) : 0;
                        $cpv_cls  = $this->cpv_class( $j['cpv_val'] );
                        if ( $j['trend'] === null ) $trend_html = '<span class="trend-na">—</span>';
                        elseif ( $j['trend'] > 0 )  $trend_html = '<span class="trend-up">▲ ' . $j['trend'] . '%</span>';
                        elseif ( $j['trend'] < 0 )  $trend_html = '<span class="trend-down">▼ ' . abs( $j['trend'] ) . '%</span>';
                        else                         $trend_html = '<span class="trend-flat">→ 0%</span>';
                    ?>
                    <tr>
                        <td><strong><?php echo esc_html( $j['author_name'] ); ?></strong><div class="hl-bar-wrap"><div class="hl-bar" style="width:<?php echo $bar; ?>%"></div></div></td>
                        <td class="num"><span class="rate-badge"><?php echo $j['cost_label']; ?></span></td>
                        <td class="num"><?php echo number_format( $j['articles'] ); ?></td>
                        <td class="num"><strong><?php echo number_format( $j['total_views'] ); ?></strong></td>
                        <td class="num"><?php echo number_format( $j['avg_views'] ); ?></td>
                        <td class="num">$<?php echo number_format( $j['total_cost'], 2 ); ?></td>
                        <td class="num cpv-col"><span class="cpv-badge <?php echo $cpv_cls; ?>"><?php echo $j['cost_per_view']; ?></span></td>
                        <td class="num"><?php echo $trend_html; ?></td>
                    </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>

            <!-- TAB: Monthly -->
            <?php elseif ( $view_tab === 'monthly' ) :
                $monthly = $this->get_monthly_breakdown( $filters ); ?>
            <div class="hl-section">
                <div class="hl-section-header"><span></span>
                    <a href="<?php echo esc_url( add_query_arg( array_merge( $qargs, [ 'export' => 'monthly', '_wpnonce' => $export_nonce ] ), $base_url ) ); ?>" class="button">⬇ Export CSV</a>
                </div>
                <?php if ( empty( $monthly ) ) : echo '<p>No data. Try selecting a date range.</p>';
                else : foreach ( $monthly as $name => $months ) : ?>
                <div class="hl-breakdown-block">
                    <h3><?php echo esc_html( $name ); ?></h3>
                    <table class="wp-list-table widefat fixed striped hl-sub-table">
                        <thead><tr><th>Month</th><th class="num">Articles</th><th class="num">Views</th><th class="num">Cost</th><th class="num cpv-col">Cost/View</th></tr></thead>
                        <tbody>
                        <?php foreach ( $months as $m ) : ?>
                        <tr>
                            <td><?php echo esc_html( $m['period'] ); ?></td>
                            <td class="num"><?php echo number_format( $m['articles'] ); ?></td>
                            <td class="num"><strong><?php echo number_format( $m['views'] ); ?></strong></td>
                            <td class="num">$<?php echo number_format( $m['cost'], 2 ); ?></td>
                            <td class="num"><span class="cpv-badge <?php echo $this->cpv_class( $m['cpv_val'] ); ?>"><?php echo $m['cpv']; ?></span></td>
                        </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endforeach; endif; ?>
            </div>

            <!-- TAB: Weekly -->
            <?php elseif ( $view_tab === 'weekly' ) :
                $weekly = $this->get_weekly_breakdown( $filters ); ?>
            <div class="hl-section">
                <div class="hl-section-header"><span></span>
                    <a href="<?php echo esc_url( add_query_arg( array_merge( $qargs, [ 'export' => 'weekly', '_wpnonce' => $export_nonce ] ), $base_url ) ); ?>" class="button">⬇ Export CSV</a>
                </div>
                <?php if ( empty( $weekly ) ) : echo '<p>No data. Try selecting a date range.</p>';
                else : foreach ( $weekly as $name => $weeks ) : ?>
                <div class="hl-breakdown-block">
                    <h3><?php echo esc_html( $name ); ?></h3>
                    <table class="wp-list-table widefat fixed striped hl-sub-table">
                        <thead><tr><th>Week</th><th class="num">Articles</th><th class="num">Views</th><th class="num">Cost</th><th class="num cpv-col">Cost/View</th></tr></thead>
                        <tbody>
                        <?php foreach ( $weeks as $w ) : ?>
                        <tr>
                            <td><?php echo esc_html( $w['period'] ); ?></td>
                            <td class="num"><?php echo number_format( $w['articles'] ); ?></td>
                            <td class="num"><strong><?php echo number_format( $w['views'] ); ?></strong></td>
                            <td class="num">$<?php echo number_format( $w['cost'], 2 ); ?></td>
                            <td class="num"><span class="cpv-badge <?php echo $this->cpv_class( $w['cpv_val'] ); ?>"><?php echo $w['cpv']; ?></span></td>
                        </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endforeach; endif; ?>
            </div>

            <!-- TAB: All Articles -->
            <?php elseif ( $view_tab === 'articles' ) :
                $articles = $this->get_articles( $filters, $cur_page ); ?>
            <div class="hl-section">
                <div class="hl-section-header">
                    <span class="hl-count"><?php echo number_format( $articles['total'] ); ?> articles</span>
                    <a href="<?php echo esc_url( add_query_arg( array_merge( $qargs, [ 'export' => 'articles', '_wpnonce' => $export_nonce ] ), $base_url ) ); ?>" class="button">⬇ Export CSV</a>
                </div>
                <table class="wp-list-table widefat fixed striped">
                    <thead><tr><th>Article</th><th>Journalist</th><th>Published</th><th class="num">Views</th><th class="num cpv-col">Cost/View</th></tr></thead>
                    <tbody>
                    <?php if ( empty( $articles['rows'] ) ) : ?><tr><td colspan="5">No articles found.</td></tr>
                    <?php else : foreach ( $articles['rows'] as $r ) : ?>
                    <tr>
                        <td><a href="<?php echo get_permalink( $r['ID'] ); ?>" target="_blank"><?php echo esc_html( $r['post_title'] ); ?></a></td>
                        <td><?php echo esc_html( $r['author_name'] ); ?></td>
                        <td><?php echo date( 'd M Y', strtotime( $r['post_date'] ) ); ?></td>
                        <td class="num"><strong><?php echo number_format( (int)$r['views'] ); ?></strong></td>
                        <td class="num"><span class="cpv-badge <?php echo $this->cpv_class( $r['cpv_val'] ); ?>"><?php echo $r['cost_per_view']; ?></span></td>
                    </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
                <?php
                $total_pages = ceil( $articles['total'] / self::POSTS_PER_PAGE );
                if ( $total_pages > 1 ) echo "<div class='hl-pagination'>" . paginate_links( [ 'base' => add_query_arg( 'paged', '%#%' ), 'format' => '', 'prev_text' => '&laquo;', 'next_text' => '&raquo;', 'total' => $total_pages, 'current' => $cur_page ] ) . "</div>";
                ?>
            </div>
            <?php endif; ?>

            <p class="hl-note">💡 <strong>Cost/View:</strong> <span class="cpv-badge cpv-good">green</span> &lt;$0.10 &nbsp;·&nbsp; <span class="cpv-badge cpv-ok">grey</span> $0.10–$0.50 &nbsp;·&nbsp; <span class="cpv-badge cpv-bad">red</span> &gt;$0.50 &nbsp;·&nbsp; <strong>Trend</strong> vs previous equivalent period</p>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // NEW: Stories per Day / Week matrix (period × category)
    // -------------------------------------------------------------------------

    private function render_output_matrix( array $filters, string $granularity, string $tax_label, array $qargs, string $base_url, string $export_nonce, int $range_days ) {
        $periods   = $this->get_output_periods( $filters, $granularity );
        $cats      = $this->get_category_summary( $filters );
        $col_terms = array_slice( $cats, 0, self::MAX_CAT_COLS );
        $matrix    = $this->get_output_matrix( $filters, $granularity );
        $is_week   = $granularity === 'week';
        $max_rows  = $is_week ? self::MAX_WEEKLY_ROWS : self::MAX_DAILY_ROWS;
        $capped    = count( $periods ) >= $max_rows;
        $peak      = 0;
        foreach ( $periods as $p ) $peak = max( $peak, $p['stories'] );
        $export    = $is_week ? 'output_weekly' : 'output_daily';
        ?>
        <div class="hl-section">
            <div class="hl-section-header">
                <span class="hl-count"><?php echo count( $periods ); ?> <?php echo $is_week ? 'weeks' : 'days'; ?> with output<?php echo $capped ? ' (most recent ' . $max_rows . ' shown — use the date filter to narrow)' : ''; ?></span>
                <a href="<?php echo esc_url( add_query_arg( array_merge( $qargs, [ 'export' => $export, '_wpnonce' => $export_nonce ] ), $base_url ) ); ?>" class="button">⬇ Export CSV</a>
            </div>
            <?php if ( empty( $periods ) ) : ?>
                <p>No stories published in the selected range.</p>
            <?php else : ?>
            <div class="hl-scroll-x">
            <table class="wp-list-table widefat fixed striped hl-matrix">
                <thead><tr>
                    <th class="hl-period-col"><?php echo $is_week ? 'Week' : 'Day'; ?></th>
                    <th class="num">Stories</th>
                    <?php foreach ( $col_terms as $t ) : ?><th class="num" title="<?php echo esc_attr( $t['term_name'] ); ?>"><?php echo esc_html( $t['term_name'] ); ?></th><?php endforeach; ?>
                    <?php if ( count( $cats ) > self::MAX_CAT_COLS ) : ?><th class="num">Other</th><?php endif; ?>
                </tr></thead>
                <tbody>
                <?php foreach ( $periods as $p ) :
                    $pk_cells = $matrix[ $p['pk'] ] ?? [];
                    $bar      = $peak > 0 ? round( ( $p['stories'] / $peak ) * 100 ) : 0;
                    $counted  = 0; ?>
                <tr>
                    <td><?php echo esc_html( $p['label'] ); ?><div class="hl-bar-wrap"><div class="hl-bar" style="width:<?php echo $bar; ?>%"></div></div></td>
                    <td class="num"><strong><?php echo number_format( $p['stories'] ); ?></strong></td>
                    <?php foreach ( $col_terms as $t ) :
                        $v = $pk_cells[ $t['term_id'] ] ?? 0; $counted += $v; ?>
                        <td class="num<?php echo $v ? '' : ' hl-zero'; ?>"><?php echo $v ? number_format( $v ) : '·'; ?></td>
                    <?php endforeach; ?>
                    <?php if ( count( $cats ) > self::MAX_CAT_COLS ) : $other = array_sum( $pk_cells ) - $counted; ?>
                        <td class="num<?php echo $other ? '' : ' hl-zero'; ?>"><?php echo $other ? number_format( $other ) : '·'; ?></td>
                    <?php endif; ?>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            </div>
            <p class="hl-note">💡 <strong>Stories</strong> is distinct published posts for that <?php echo $is_week ? 'week' : 'day'; ?>. The <?php echo esc_html( strtolower( $tax_label ) ); ?> columns count a story once per category it is tagged with, so they can sum to more than <strong>Stories</strong>. Columns show the top <?php echo self::MAX_CAT_COLS; ?> categories in range<?php echo count( $cats ) > self::MAX_CAT_COLS ? '; the rest are grouped as “Other”' : ''; ?>.</p>
            <?php endif; ?>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // PIN screen
    // -------------------------------------------------------------------------

    private function render_pin_screen() {
        ?>
        <div class="wrap">
            <div class="hl-pin-screen">
                <div class="hl-pin-card">
                    <div class="hl-pin-logo">📊</div>
                    <h2>Journalist Stats</h2>
                    <p>Enter your 4-digit PIN to view the dashboard.</p>
                    <div class="hl-pin-dots" id="hl-pin-dots">
                        <span></span><span></span><span></span><span></span>
                    </div>
                    <div class="hl-pin-pad">
                        <?php foreach ( [ 1,2,3,4,5,6,7,8,9,'',0,'&#9003;' ] as $k ) : ?>
                        <button type="button" class="hl-pin-key" data-key="<?php echo esc_attr( $k ); ?>"><?php echo $k; ?></button>
                        <?php endforeach; ?>
                    </div>
                    <p class="hl-pin-error" id="hl-pin-error" style="display:none;color:#a00;font-size:13px;">Incorrect PIN — try again.</p>
                </div>
            </div>
        </div>
        <?php
    }

}
