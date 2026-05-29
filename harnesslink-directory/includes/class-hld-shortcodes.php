<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_Shortcodes {

    public static function init() {
        add_shortcode( 'harnesslink_directory', array( __CLASS__, 'directory' ) );
        add_shortcode( 'harnesslink_stallion',  array( __CLASS__, 'stallion_profile' ) );
    }

    /**
     * [harnesslink_directory]                 → full hub, defaults to stallions
     * [harnesslink_directory type="trainer"]  → opens on the Trainer category
     * [harnesslink_directory nav="false"]     → hide the category navigation
     */
    public static function directory( $atts ) {
        $a = shortcode_atts( array(
            'type' => '',
            'nav'  => 'true',
        ), $atts, 'harnesslink_directory' );

        // Exposed to the template (GET ?hld_type still overrides for in-page nav).
        $hld_shortcode_type = HLD_Types::sanitize_slug( $a['type'] );
        $hld_show_nav       = ! in_array( strtolower( (string) $a['nav'] ), array( 'false', '0', 'no' ), true );

        ob_start();
        include HLD_PLUGIN_DIR . 'templates/directory-page.php';
        return ob_get_clean();
    }

    public static function stallion_profile( $atts ) {
        $a = shortcode_atts( array( 'id' => 0 ), $atts );
        if ( ! $a['id'] ) return '';
        $stallion = HLD_DB::get_stallion( $a['id'] );
        if ( ! $stallion ) return '<p>Listing not found.</p>';
        ob_start();
        include HLD_PLUGIN_DIR . 'templates/stallion-profile.php';
        return ob_get_clean();
    }
}
