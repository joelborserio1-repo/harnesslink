<?php
/**
 * AD_Scheduler — Multi-source scheduling engine.
 *
 * Supports three modes:
 *   together     – all sources run on the same interval at the same time
 *   alternating  – sources take turns: run source A, wait interval, run source B, wait, repeat
 *   independent  – each source has its own interval and runs independently
 *
 * WP-Cron hooks registered:
 *   ad_scheduled_scrape_together   – fires for "together" mode (runs all sources)
 *   ad_scheduled_scrape_{slug}     – fires per-source (alternating + independent modes)
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_Scheduler {

    /** All known per-source hook names, kept for clean teardown */
    private static function all_hooks() {
        $hooks = [ 'ad_scheduled_scrape', 'ad_scheduled_scrape_together' ];
        foreach ( array_keys( AD_Sources::get_all() ) as $slug ) {
            $hooks[] = 'ad_scheduled_scrape_' . $slug;
        }
        return $hooks;
    }

    public function __construct() {
        add_filter( 'cron_schedules', [ $this, 'add_intervals' ] );

        // Hook all possible cron events
        add_action( 'ad_scheduled_scrape',          [ $this, 'run_legacy_scrape' ] ); // backwards compat
        add_action( 'ad_scheduled_scrape_together',  [ $this, 'run_together' ] );

        foreach ( array_keys( AD_Sources::get_all() ) as $slug ) {
            add_action( 'ad_scheduled_scrape_' . $slug, function() use ( $slug ) {
                $this->run_single_source( $slug );
            } );
        }

        add_action( 'init', [ $this, 'maybe_schedule' ] );

        // Re-schedule whenever relevant options change
        foreach ( [ 'ad_schedule_mode', 'ad_auto_schedule', 'ad_schedule_interval' ] as $opt ) {
            add_action( 'update_option_' . $opt, [ $this, 'reschedule_all' ], 10, 0 );
        }
        foreach ( array_keys( AD_Sources::get_all() ) as $slug ) {
            add_action( 'update_option_ad_schedule_' . $slug, [ $this, 'reschedule_all' ], 10, 0 );
        }
    }

    /* =========================================================
       INTERVALS
    ========================================================= */

    public function add_intervals( $schedules ) {
        $custom = [
            'every_15_minutes' => [ 'interval' => 15 * MINUTE_IN_SECONDS, 'display' => __( 'Every 15 Minutes', 'article-duplicator' ) ],
            'every_30_minutes' => [ 'interval' => 30 * MINUTE_IN_SECONDS, 'display' => __( 'Every 30 Minutes', 'article-duplicator' ) ],
            'every_6_hours'    => [ 'interval' => 6  * HOUR_IN_SECONDS,   'display' => __( 'Every 6 Hours',    'article-duplicator' ) ],
            'every_12_hours'   => [ 'interval' => 12 * HOUR_IN_SECONDS,   'display' => __( 'Every 12 Hours',   'article-duplicator' ) ],
        ];
        return array_merge( $schedules, $custom );
    }

    /* =========================================================
       SCHEDULING LOGIC
    ========================================================= */

    public function maybe_schedule() {
        if ( ! get_option( 'ad_auto_schedule', '0' ) ) {
            $this->clear_all();
            return;
        }
        $this->setup_schedules();
    }

    /** Called whenever a relevant option changes */
    public function reschedule_all() {
        $this->clear_all();
        if ( get_option( 'ad_auto_schedule', '0' ) ) {
            $this->setup_schedules();
        }
    }

    /** Clear every artdup cron event */
    public function clear_all() {
        foreach ( self::all_hooks() as $hook ) {
            wp_clear_scheduled_hook( $hook );
        }
    }

    private function setup_schedules() {
        $mode    = get_option( 'ad_schedule_mode', 'together' );
        $sources = AD_Sources::get_all();

        if ( $mode === 'together' ) {
            $interval = get_option( 'ad_schedule_interval', 'hourly' );
            if ( ! wp_next_scheduled( 'ad_scheduled_scrape_together' ) ) {
                wp_schedule_event( time(), $interval, 'ad_scheduled_scrape_together' );
            }

        } elseif ( $mode === 'alternating' ) {
            /*
             * Alternating: source A fires at T+0, source B at T+interval, source C at T+2×interval…
             * They all share the same interval but are staggered so they never overlap.
             */
            $interval     = get_option( 'ad_schedule_interval', 'hourly' );
            $interval_sec = $this->interval_to_seconds( $interval );
            $slugs        = array_keys( $sources );
            $count        = count( $slugs );

            // Stagger offset = interval / number_of_sources
            $offset = $count > 1 ? (int) floor( $interval_sec / $count ) : 0;

            foreach ( $slugs as $i => $slug ) {
                $hook = 'ad_scheduled_scrape_' . $slug;
                if ( ! wp_next_scheduled( $hook ) ) {
                    $start = time() + ( $i * $offset );
                    wp_schedule_event( $start, $interval, $hook );
                }
            }

        } elseif ( $mode === 'independent' ) {
            /*
             * Independent: each source has its own interval stored as
             * option  ad_schedule_{slug}  e.g. ad_schedule_letrot = 'hourly'
             */
            foreach ( array_keys( $sources ) as $slug ) {
                $interval = get_option( 'ad_schedule_' . $slug, 'hourly' );
                $hook     = 'ad_scheduled_scrape_' . $slug;
                if ( ! wp_next_scheduled( $hook ) ) {
                    wp_schedule_event( time(), $interval, $hook );
                }
            }
        }
    }

    /* =========================================================
       CRON CALLBACKS
    ========================================================= */

    /** Run all sources at once (together mode) */
    public function run_together() {
        foreach ( array_keys( AD_Sources::get_all() ) as $slug ) {
            $this->run_single_source( $slug );
        }
    }

    /** Run a single source by slug */
    public function run_single_source( $slug ) {
        $source_cfg = AD_Sources::get( $slug );
        if ( ! $source_cfg ) return;

        // Temporarily override the source URL option so the scraper picks it up
        $original_url  = get_option( 'ad_source_url' );
        $original_slug = get_option( 'ad_source_slug' );

        update_option( 'ad_source_url',  $source_cfg['url'] );
        update_option( 'ad_source_slug', $slug );

        $scraper  = new AD_Scraper();
        $importer = new AD_Importer();

        $articles = $scraper->fetch_article_list();

        if ( ! is_wp_error( $articles ) ) {
            foreach ( $articles as $article ) {
                $full = $scraper->fetch_article_content( $article['url'] );
                if ( is_wp_error( $full ) ) continue;

                $data           = array_merge( $article, $full );
                $data['url']    = $article['url'];
                $data['source'] = $article['url'];
                if ( empty( $data['title'] ) ) $data['title'] = $article['title'];

                $importer->import( $data );
                sleep( 1 );
            }
        }

        // Restore original settings
        update_option( 'ad_source_url',  $original_url );
        update_option( 'ad_source_slug', $original_slug );
    }

    /** Backwards-compat: old single-source hook */
    public function run_legacy_scrape() {
        $slug = get_option( 'ad_source_slug', '' );
        if ( $slug ) {
            $this->run_single_source( $slug );
        } else {
            // Custom URL — just run the scraper as before
            $scraper  = new AD_Scraper();
            $importer = new AD_Importer();
            $articles = $scraper->fetch_article_list();
            if ( is_wp_error( $articles ) ) return;
            foreach ( $articles as $article ) {
                $full = $scraper->fetch_article_content( $article['url'] );
                if ( is_wp_error( $full ) ) continue;
                $data = array_merge( $article, $full );
                $data['url'] = $data['source'] = $article['url'];
                $importer->import( $data );
                sleep(1);
            }
        }
    }

    /* =========================================================
       STATUS HELPERS  (used by dashboard + settings)
    ========================================================= */

    /**
     * Returns an array of schedule status rows, one per active cron event.
     * [ ['source' => label, 'hook' => hook, 'interval' => label, 'next_run' => formatted] ]
     */
    public function get_schedule_status() {
        $rows    = [];
        $sources = AD_Sources::get_all();
        $mode    = get_option( 'ad_schedule_mode', 'together' );
        $enabled = (bool) get_option( 'ad_auto_schedule', '0' );

        if ( ! $enabled ) return $rows;

        if ( $mode === 'together' ) {
            $ts = wp_next_scheduled( 'ad_scheduled_scrape_together' );
            $rows[] = [
                'source'   => __( 'All Sources (Together)', 'article-duplicator' ),
                'interval' => $this->interval_label( get_option('ad_schedule_interval','hourly') ),
                'next_run' => $ts ? date_i18n( 'D j M Y, H:i', $ts ) : '—',
                'mode'     => 'together',
            ];
        } elseif ( $mode === 'alternating' ) {
            $interval = get_option( 'ad_schedule_interval', 'hourly' );
            foreach ( $sources as $slug => $src ) {
                $ts = wp_next_scheduled( 'ad_scheduled_scrape_' . $slug );
                $rows[] = [
                    'source'   => $src['label'],
                    'interval' => $this->interval_label( $interval ) . ' ' . __( '(alternating)', 'article-duplicator' ),
                    'next_run' => $ts ? date_i18n( 'D j M Y, H:i', $ts ) : '—',
                    'mode'     => 'alternating',
                ];
            }
        } elseif ( $mode === 'independent' ) {
            foreach ( $sources as $slug => $src ) {
                $interval = get_option( 'ad_schedule_' . $slug, 'hourly' );
                $ts       = wp_next_scheduled( 'ad_scheduled_scrape_' . $slug );
                $rows[] = [
                    'source'   => $src['label'],
                    'interval' => $this->interval_label( $interval ),
                    'next_run' => $ts ? date_i18n( 'D j M Y, H:i', $ts ) : '—',
                    'mode'     => 'independent',
                ];
            }
        }

        return $rows;
    }

    /** For backwards compat — returns next run of first scheduled event */
    public function get_next_run() {
        $status = $this->get_schedule_status();
        if ( empty( $status ) ) return __( 'Not scheduled', 'article-duplicator' );
        return $status[0]['next_run'];
    }

    /* =========================================================
       HELPERS
    ========================================================= */

    private function interval_to_seconds( $interval ) {
        $map = [
            'every_15_minutes' => 15 * MINUTE_IN_SECONDS,
            'every_30_minutes' => 30 * MINUTE_IN_SECONDS,
            'hourly'           => HOUR_IN_SECONDS,
            'every_6_hours'    => 6  * HOUR_IN_SECONDS,
            'every_12_hours'   => 12 * HOUR_IN_SECONDS,
            'daily'            => DAY_IN_SECONDS,
            'twicedaily'       => 12 * HOUR_IN_SECONDS,
        ];
        return $map[ $interval ] ?? HOUR_IN_SECONDS;
    }

    private function interval_label( $interval ) {
        $map = [
            'every_15_minutes' => __( 'Every 15 min',  'article-duplicator' ),
            'every_30_minutes' => __( 'Every 30 min',  'article-duplicator' ),
            'hourly'           => __( 'Hourly',         'article-duplicator' ),
            'every_6_hours'    => __( 'Every 6 hours', 'article-duplicator' ),
            'every_12_hours'   => __( 'Every 12 hours','article-duplicator' ),
            'daily'            => __( 'Daily',          'article-duplicator' ),
            'twicedaily'       => __( 'Twice daily',    'article-duplicator' ),
        ];
        return $map[ $interval ] ?? $interval;
    }
}
