<?php
/**
 * Uninstall handler for HarnessLink Insider Panel.
 *
 * Runs when the plugin is deleted from the WordPress admin. The plugin does
 * not persist options or custom tables by default; this is here so that if
 * any options are ever stored under the hl_insider_ prefix they are removed
 * cleanly. Block/shortcode content lives inside post content and is
 * intentionally left untouched.
 *
 * @package HL_Insider_Panel
 */

// Exit if not called by WordPress during uninstall.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Single site.
delete_option( 'hl_insider_settings' );

// Multisite: clean each site's option, if applicable.
if ( is_multisite() ) {
	$sites = get_sites( array( 'fields' => 'ids' ) );
	foreach ( $sites as $blog_id ) {
		switch_to_blog( $blog_id );
		delete_option( 'hl_insider_settings' );
		restore_current_blog();
	}
}
