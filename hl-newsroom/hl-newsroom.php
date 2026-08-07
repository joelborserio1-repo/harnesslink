<?php
/**
 * Plugin Name: HarnessLink Newsroom
 * Plugin URI:  https://harnesslink.com
 * Description: Internal newsroom intake, triage, and drafting tools for the HarnessLink editorial team.
 * Version:     0.1.0
 * Author:      HarnessLink
 * License:     GPL-2.0+
 * Text Domain: hl-newsroom
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'HLN_VERSION',     '0.1.0' );
define( 'HLN_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'HLN_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'HLN_PLUGIN_FILE', __FILE__ );

require_once HLN_PLUGIN_DIR . 'includes/class-hln-sources.php';

/* ---- Phase 2: news@ intake, race-data feeds, racing intelligence ---- */
require_once HLN_PLUGIN_DIR . 'includes/class-hln-db.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-parsing-utils.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-cron-utils.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-intake-log.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-stewards-parser.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-email-intake.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-race-data.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-racing-intelligence.php';

/* ---- Phase 3: RSS + verified-X intake, trending signal ---- */
require_once HLN_PLUGIN_DIR . 'includes/class-hln-rss-intake.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-x-poller.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-trending-signal.php';

/* ---- Phase 4: triage gate, Story Candidate CPT, dedup, trending score ----
require_once HLN_PLUGIN_DIR . 'includes/class-hln-candidate-cpt.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-triage.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-dedup.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-trending.php';
*/

/* ---- Phase 5: templates, story generator ----
require_once HLN_PLUGIN_DIR . 'includes/class-hln-templates.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-story-generator.php';
*/

/* ---- Phase 6: editorial dashboard ----
require_once HLN_PLUGIN_DIR . 'includes/class-hln-dashboard.php';
*/

/* ---- Phase 7: outbound RSS, public API, syndication, popular, insider ----
require_once HLN_PLUGIN_DIR . 'includes/class-hln-outbound-rss.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-public-api.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-syndication.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-popular.php';
require_once HLN_PLUGIN_DIR . 'includes/class-hln-insider.php';
*/

require_once HLN_PLUGIN_DIR . 'includes/class-hln-admin.php';

register_activation_hook( __FILE__, 'hln_activate' );
register_deactivation_hook( __FILE__, 'hln_deactivate' );

function hln_activate() {
	$defaults = [
		'hln_default_byline'             => 'HarnessLink Media',
		'hln_inbound_email_signing_key'  => '',
		'hln_x_api_bearer_token'         => '',
		'hln_regions'                    => "USA\nCanada\nAustralia\nNew Zealand\nEurope",
		'hln_subcategories'              => "News\nEntries\nResults\nBreeding",
		'hln_is_premium_defaults'        => [
			'news'     => false,
			'preview'  => false,
			'result'   => false,
			'feature'  => false,
			'breeding' => false,
			'industry' => false,
		],
		'hln_source_overrides'           => [],
		'hln_verified_social_accounts'   => [],
	];
	foreach ( $defaults as $key => $val ) {
		if ( false === get_option( $key ) ) {
			add_option( $key, $val );
		}
	}

	HLN_DB::install();
}

function hln_deactivate() {
	foreach ( HLN_Sources::SOURCE_TYPES as $type ) {
		foreach ( HLN_Sources::get_by_type( $type ) as $slug => $entry ) {
			wp_clear_scheduled_hook( 'hln_race_data_poll_' . $type . ':' . $slug );
			wp_clear_scheduled_hook( 'hln_rss_poll_' . $type . ':' . $slug );
		}
	}
	wp_clear_scheduled_hook( 'hln_race_calendar_poll' );

	foreach ( HLN_Sources::get_verified_social_accounts() as $handle => $account ) {
		wp_clear_scheduled_hook( 'hln_x_poll_' . $handle );
	}
	wp_clear_scheduled_hook( 'hln_trending_signal_scan' );

	// Later phases clear their own scheduled hooks here (Insider, etc.).
}

function hln_init() {
	HLN_DB::maybe_upgrade();

	new HLN_Admin();
	new HLN_Email_Intake();
	new HLN_Race_Data();
	new HLN_Racing_Intelligence();
	new HLN_RSS_Intake();
	new HLN_X_Poller();
	new HLN_Trending_Signal();
	// HLN_Stewards_Parser, HLN_Parsing_Utils, and HLN_Cron_Utils are
	// stateless static helpers, called directly by the classes above —
	// nothing to wire here.

	/*
	 * Later-phase classes, instantiated here once they exist:
	 *
	 * new HLN_Candidate_CPT();         // Phase 4
	 * new HLN_Triage();                // Phase 4
	 * new HLN_Dedup();                 // Phase 4
	 * new HLN_Trending();              // Phase 4
	 * new HLN_Story_Generator();       // Phase 5
	 * new HLN_Dashboard();             // Phase 6
	 * new HLN_Outbound_RSS();          // Phase 7
	 * new HLN_Public_API();            // Phase 7
	 * new HLN_Syndication();           // Phase 7
	 * new HLN_Popular();               // Phase 7
	 * new HLN_Insider();               // Phase 7
	 */
}
add_action( 'plugins_loaded', 'hln_init' );
