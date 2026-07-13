<?php
/**
 * Plugin Name: HarnessLink Journalist Stats
 * Plugin URI:  https://harnesslink.com
 * Description: Dashboard showing story output per day / week and by category (USA, AU, …) plus views and cost per journalist. Powered by WordPress core post data and WordPress Popular Posts.
 * Version:     3.1.1
 * Author:      Joel Borserio
 * Author URI:  https://harnesslink.com
 * Text Domain: harnesslink-stats
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HL_STATS_VERSION', '3.1.1' );
define( 'HL_STATS_PATH', plugin_dir_path( __FILE__ ) );
define( 'HL_STATS_URL', plugin_dir_url( __FILE__ ) );

require_once HL_STATS_PATH . 'includes/class-stats.php';

/**
 * On activation, ensure the dashboard PIN is 1234.
 */
register_activation_hook( __FILE__, function () {
    update_option( 'hl_stats_pin', '1234' );
    update_option( 'hl_stats_pin_forced_1234', 1 );
} );

new HL_Stats();
