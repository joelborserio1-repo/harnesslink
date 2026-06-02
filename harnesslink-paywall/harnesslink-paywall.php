<?php
/**
 * Plugin Name: HarnessLink PayWall
 * Plugin URI:  https://harnesslink.com
 * Description: HarnessLink companion for Leaky Paywall. Restyles the registration wall (frosted lead-in teaser + clean navy signup card) and rebrands the Leaky Paywall admin experience as "HarnessLink PayWall". Cosmetic only — does not change metering, restriction counts, access levels or any server-side gating.
 * Version:     1.0.0
 * Author:      HarnessLink
 * Text Domain: harnesslink-paywall
 *
 * This plugin intentionally lives OUTSIDE Leaky Paywall so the styling and
 * rebrand survive Leaky Paywall updates and no LP core file is edited.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'HLPW_VERSION',    '1.0.0' );
define( 'HLPW_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/* ------------------------------------------------------------------ *
 * 1. Front-end wall styling
 *    Load the wall CSS only when Leaky Paywall is present.
 * ------------------------------------------------------------------ */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! hlpw_leaky_paywall_active() ) {
		return;
	}

	// No hard dependency on LP's 'issuem-leaky-paywall' handle: LP only
	// enqueues it when its CSS style is "default", so depending on it would
	// suppress our styles on sites using a custom/none style. Priority 20 +
	// our selector specificity (and targeted !important) keep us winning.
	wp_enqueue_style(
		'harnesslink-paywall-wall',
		HLPW_PLUGIN_URL . 'assets/harnesslink-paywall-wall.css',
		array(),
		HLPW_VERSION
	);
}, 20 );

/* ------------------------------------------------------------------ *
 * 2. Make the lead-in teaser targetable so CSS can blur it.
 *
 *    Leaky Paywall outputs the nag excerpt as a bare, unwrapped text
 *    node (wp_strip_all_tags + substr), which CSS cannot select. We
 *    wrap that already-public excerpt in <span class="hl-paywall-teaser">
 *    via LP's own filter. This is purely cosmetic markup: it does not
 *    change what text LP exposes, the restriction count, or any gating.
 * ------------------------------------------------------------------ */
add_filter( 'leaky_paywall_nag_excerpt', function ( $excerpt ) {
	$excerpt = trim( (string) $excerpt );

	if ( '' === $excerpt ) {
		return $excerpt;
	}

	return '<span class="hl-paywall-teaser">' . $excerpt . '&hellip;</span>';
}, 20 );

/* ------------------------------------------------------------------ *
 * 3. Rebrand "Leaky Paywall" -> "HarnessLink PayWall"
 *    Done via filters so no LP core file is touched and the rebrand
 *    survives plugin updates. Covers the admin menu, the Plugins-list
 *    row, and user-facing "Leaky Paywall" strings.
 * ------------------------------------------------------------------ */

/** The brand label shown everywhere in place of "Leaky Paywall". */
function hlpw_brand_label() {
	return 'HarnessLink PayWall';
}

/** True when Leaky Paywall is loaded. */
function hlpw_leaky_paywall_active() {
	return defined( 'LEAKY_PAYWALL_VERSION' ) || class_exists( 'Leaky_Paywall' );
}

// 3a. Rename the top-level admin menu + submenu titles.
add_action( 'admin_menu', function () {
	global $menu, $submenu;

	if ( ! is_array( $menu ) ) {
		return;
	}

	foreach ( $menu as &$item ) {
		if ( isset( $item[0] ) && false !== stripos( $item[0], 'Leaky Paywall' ) ) {
			$item[0] = str_ireplace( 'Leaky Paywall', hlpw_brand_label(), $item[0] );
		}
	}
	unset( $item );

	if ( isset( $submenu['leaky-paywall'] ) ) {
		foreach ( $submenu['leaky-paywall'] as &$sub ) {
			if ( isset( $sub[0] ) ) {
				$sub[0] = str_ireplace( 'Leaky Paywall', hlpw_brand_label(), $sub[0] );
			}
		}
		unset( $sub );
	}
}, 999 );

// 3b. Rename the Plugins-list row for Leaky Paywall.
add_filter( 'all_plugins', function ( $plugins ) {
	foreach ( $plugins as $file => $data ) {
		if ( isset( $data['Name'] ) && false !== stripos( $data['Name'], 'Leaky Paywall' ) ) {
			$plugins[ $file ]['Name']        = str_ireplace( 'Leaky Paywall', hlpw_brand_label(), $data['Name'] );
			$plugins[ $file ]['Description']  = isset( $data['Description'] )
				? str_ireplace( 'Leaky Paywall', hlpw_brand_label(), $data['Description'] )
				: $data['Description'];
		}
	}
	return $plugins;
} );

// 3c. Rename user-facing "Leaky Paywall" strings (admin + front-end).
//     Scoped to the leaky-paywall text domain so we only touch LP output.
add_filter( 'gettext_leaky-paywall', function ( $translation, $text, $domain ) {
	if ( false !== stripos( $translation, 'Leaky Paywall' ) ) {
		$translation = str_ireplace( 'Leaky Paywall', hlpw_brand_label(), $translation );
	}
	return $translation;
}, 10, 3 );
