<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_Shortcodes {

    public static function init() {
        add_shortcode( 'harnesslink_directory', array( __CLASS__, 'directory' ) );
        add_shortcode( 'harnesslink_stallion',  array( __CLASS__, 'stallion_profile' ) );
        add_shortcode( 'harnesslink_advertise',  array( __CLASS__, 'advertise' ) );
    }

    /**
     * [harnesslink_advertise]                       → full marketing / advertise landing page
     * [harnesslink_advertise email="ads@x.com"]     → override the direct contact email
     * [harnesslink_advertise scheduler="https://calendly.com/…"]  → booking calendar URL
     * [harnesslink_advertise phone="+61 3 5555 1234"]            → direct phone
     *
     * Attributes fall back to the values configured under
     * HarnessLink → Settings, then to sensible site defaults.
     */
    public static function advertise( $atts ) {
        $a = shortcode_atts( array(
            'email'     => '',
            'phone'     => '',
            'scheduler' => '',
        ), $atts, 'harnesslink_advertise' );

        $hld_contact_email = $a['email']     ?: get_option( 'hld_advertise_email', get_option( 'admin_email' ) );
        $hld_phone         = $a['phone']     ?: get_option( 'hld_advertise_phone', '' );
        $hld_scheduler_url = $a['scheduler'] ?: get_option( 'hld_scheduler_url', '' );

        // Sanitise for safe template use.
        $hld_contact_email = sanitize_email( $hld_contact_email );
        $hld_phone         = sanitize_text_field( $hld_phone );
        $hld_scheduler_url = esc_url_raw( $hld_scheduler_url );

        ob_start();
        include HLD_PLUGIN_DIR . 'templates/advertise-page.php';
        return ob_get_clean();
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
