<?php
/**
 * Plugin Name:       HarnessLink Insider Panel
 * Plugin URI:        https://harnesslink.com/the-insider/
 * Description:        A "The Insider" subscribe panel as an editable Gutenberg block and a [insider_panel] shortcode. Non-technical friendly, dependency-free.
 * Version:           1.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.2
 * Author:            HarnessLink
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       hl-insider
 *
 * @package HL_Insider_Panel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

/* -------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------- */
define( 'HL_INSIDER_VERSION', '1.1.0' );
define( 'HL_INSIDER_FILE', __FILE__ );
define( 'HL_INSIDER_DIR', plugin_dir_path( __FILE__ ) );
define( 'HL_INSIDER_URL', plugin_dir_url( __FILE__ ) );

/* -------------------------------------------------------------------------
 * Includes
 * ---------------------------------------------------------------------- */
require_once HL_INSIDER_DIR . 'includes/admin-settings.php';

/**
 * Whether to load Google Fonts. Themes that already load Playfair Display +
 * Source Sans 3 can disable this with:
 *     add_filter( 'hl_insider_load_fonts', '__return_false' );
 * or by defining the constant HL_INSIDER_DISABLE_FONTS as true.
 *
 * @return bool
 */
function hl_insider_load_fonts() {
	$load = ! ( defined( 'HL_INSIDER_DISABLE_FONTS' ) && HL_INSIDER_DISABLE_FONTS );
	return (bool) apply_filters( 'hl_insider_load_fonts', $load );
}

/* -------------------------------------------------------------------------
 * Defaults
 * ---------------------------------------------------------------------- */
/**
 * Hard-coded base defaults (the original reference values). These are the
 * ultimate fallback used when nothing has been saved in the dashboard.
 *
 * @return array
 */
function hl_insider_base_defaults() {
	return array(
		'eyebrow'       => __( 'THE INSIDER', 'hl-insider' ),
		'headline'      => "Exclusive insights.\nEvery Thursday.",
		'subhead'       => __( "In-depth stories, industry whispers and international coverage you won't find anywhere else.", 'hl-insider' ),
		'badge_top'     => __( 'SUBSCRIBE', 'hl-insider' ),
		'badge_bottom'  => __( 'FREE', 'hl-insider' ),
		'show_badge'    => true,
		'cta_text'      => __( 'Subscribe Now', 'hl-insider' ),
		'cta_url'       => 'https://harnesslink.com/the-insider/editions/',
		'cta_new_tab'   => false,
		'week_label'    => __( 'THIS WEEK ON THE INSIDER', 'hl-insider' ),
		'schedule_text' => __( 'Every Thursday 3PM', 'hl-insider' ),
		'show_schedule' => true,
		'proof_text'    => __( 'Join 7,000+ harness racing readers every Thursday.', 'hl-insider' ),
		'show_proof'    => true,
		// Layout / position.
		'pad_left'      => 20,    // Horizontal gutter (px). May be negative to pull left.
		'offset_top'    => 0,     // Vertical nudge (px). Negative pulls it up toward the widget above.
		'hpos'          => 'center', // Horizontal position within its column: left | center | right.
		'fixed_height'  => true,
		// Colours.
		'color_navy'    => '#0e2455',
		'color_accent'  => '#244287',
		'color_gold'    => '#c9a24b',
		'color_ink'     => '#16213f',
		'color_muted'   => '#5b6478',
		'color_line'    => '#e4e6ec',
	);
}

/**
 * Effective default attribute values: the base defaults with any values saved
 * in the dashboard (Insider Panel admin page) layered on top. Shared by the
 * block, the shortcode and the render function, so editing the dashboard
 * updates every panel that hasn't been individually overridden.
 *
 * @return array
 */
function hl_insider_defaults() {
	$base  = hl_insider_base_defaults();
	$saved = get_option( 'hl_insider_settings', array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	// Only merge known scalar keys; items are handled separately.
	$scalars = array();
	foreach ( $base as $key => $val ) {
		if ( array_key_exists( $key, $saved ) && '' !== $saved[ $key ] && null !== $saved[ $key ] ) {
			$scalars[ $key ] = $saved[ $key ];
		}
	}
	return wp_parse_args( $scalars, $base );
}

/**
 * The four default "This week" items with their icon keys.
 *
 * @return array
 */
function hl_insider_default_items() {
	return array(
		array(
			'text' => __( "Why one major stable is suddenly changing drivers\u{2026}", 'hl-insider' ),
			'icon' => 'lines',
		),
		array(
			'text' => __( 'The sales trends quietly reshaping the breeding market', 'hl-insider' ),
			'icon' => 'trend',
		),
		array(
			'text' => __( 'US racing controversy insiders are talking about', 'hl-insider' ),
			'icon' => 'alert',
		),
		array(
			'text' => __( '3 horses flying under the radar this week', 'hl-insider' ),
			'icon' => 'eye',
		),
	);
}

/**
 * The "This week" items to fall back to at render time: items saved in the
 * dashboard if present, otherwise the four hard-coded defaults.
 *
 * @return array
 */
function hl_insider_resolved_items() {
	$saved = get_option( 'hl_insider_settings', array() );
	if ( is_array( $saved ) && ! empty( $saved['items'] ) && is_array( $saved['items'] ) ) {
		$items = array();
		foreach ( $saved['items'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$text = isset( $row['text'] ) ? trim( (string) $row['text'] ) : '';
			if ( '' === $text ) {
				continue;
			}
			$items[] = array(
				'text' => $text,
				'icon' => isset( $row['icon'] ) ? sanitize_key( $row['icon'] ) : 'lines',
			);
		}
		if ( ! empty( $items ) ) {
			return $items;
		}
	}
	return hl_insider_default_items();
}

/* -------------------------------------------------------------------------
 * Icon SVG map
 * ---------------------------------------------------------------------- */
/**
 * Map of icon keys to the inner SVG markup (path/circle/rect children only).
 * The wrapping <svg viewBox="0 0 24 24"> is added at render time.
 *
 * @return array
 */
function hl_insider_icons() {
	return array(
		'lines'    => '<path d="M4 5h16M4 12h16M4 19h10"/>',
		'trend'    => '<path d="M4 18 L9 11 L13 14 L20 5"/><path d="M20 9V5h-4"/>',
		'alert'    => '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
		'eye'      => '<circle cx="12" cy="12" r="3.5"/><path d="M3 12a9 5 0 0 1 18 0M3 12a9 5 0 0 0 18 0"/>',
		'star'     => '<path d="M12 3l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3L12 17.8 6.4 20.2 7.8 13.9 3 9.7l6.4-.6z"/>',
		'flag'     => '<path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/>',
		'calendar' => '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
		'dollar'   => '<path d="M12 2v20"/><path d="M16 6.5C16 4.6 14.2 3.5 12 3.5S8 4.6 8 6.5 9.8 9.5 12 9.5s4 1.6 4 3.5-1.8 3-4 3-4-1.1-4-3"/>',
	);
}

/**
 * Human-readable labels for the icon keys (used by the editor dropdown).
 *
 * @return array
 */
function hl_insider_icon_labels() {
	return array(
		'lines'    => __( 'Lines / Article', 'hl-insider' ),
		'trend'    => __( 'Trend up', 'hl-insider' ),
		'alert'    => __( 'Alert / Info', 'hl-insider' ),
		'eye'      => __( 'Eye', 'hl-insider' ),
		'star'     => __( 'Star', 'hl-insider' ),
		'flag'     => __( 'Flag', 'hl-insider' ),
		'calendar' => __( 'Calendar', 'hl-insider' ),
		'dollar'   => __( 'Dollar', 'hl-insider' ),
	);
}

/**
 * Return the inner SVG for an icon key, falling back to 'lines'.
 *
 * @param string $key Icon key.
 * @return string
 */
function hl_insider_icon_svg( $key ) {
	$icons = hl_insider_icons();
	$key   = isset( $icons[ $key ] ) ? $key : 'lines';
	return $icons[ $key ];
}

/* -------------------------------------------------------------------------
 * Text helpers
 * ---------------------------------------------------------------------- */
/**
 * Convert a headline string with \n or | separators into escaped HTML with
 * <br> tags. Each line is individually escaped.
 *
 * @param string $text Raw headline.
 * @return string Safe HTML.
 */
function hl_insider_format_headline( $text ) {
	$text  = (string) $text;
	$text  = str_replace( array( "\r\n", "\r" ), "\n", $text );
	// Treat a literal backslash-n (from shortcode atts) and the pipe as breaks too.
	$text  = str_replace( array( '\\n', '|' ), "\n", $text );
	$parts = explode( "\n", $text );
	$parts = array_map( 'esc_html', $parts );
	return implode( '<br>', $parts );
}

/**
 * Format the proof line. Supports **bold** markdown; if none is present it
 * auto-bolds the first number-with-optional-plus match (e.g. "7,000+").
 * Output is escaped and limited to <b>/<strong> via wp_kses.
 *
 * @param string $text Raw proof text.
 * @return string Safe HTML.
 */
function hl_insider_format_proof( $text ) {
	$text = (string) $text;

	if ( false !== strpos( $text, '**' ) ) {
		// Escape first, then turn the (escaped) ** markers into <b>.
		$safe = esc_html( $text );
		$safe = preg_replace( '/\*\*(.+?)\*\*/s', '<b>$1</b>', $safe );
	} else {
		$safe = esc_html( $text );
		// Auto-bold the first number, allowing thousands separators and a trailing +.
		$safe = preg_replace( '/(\d[\d,\.]*\+?)/', '<b>$1</b>', $safe, 1 );
	}

	return wp_kses(
		$safe,
		array(
			'b'      => array(),
			'strong' => array(),
		)
	);
}

/**
 * Sanitize a hex colour, returning the fallback when invalid.
 *
 * @param string $value    Candidate colour.
 * @param string $fallback Default colour.
 * @return string
 */
function hl_insider_sanitize_color( $value, $fallback ) {
	$value = sanitize_text_field( (string) $value );
	if ( preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $value ) ) {
		return $value;
	}
	return $fallback;
}

/* -------------------------------------------------------------------------
 * Shared render function
 * ---------------------------------------------------------------------- */
/**
 * Render the Insider panel. Used by BOTH the block render_callback and the
 * shortcode so output is always identical.
 *
 * @param array $atts  Attributes (already merged with defaults by caller, but
 *                      this function also fills gaps defensively).
 * @param array $items Array of items: each [ 'text' => string, 'icon' => key ].
 * @return string HTML.
 */
function hl_insider_render( $atts = array(), $items = array() ) {
	$d    = hl_insider_defaults();
	$atts = wp_parse_args( is_array( $atts ) ? $atts : array(), $d );

	// Items fallback (dashboard items, then hard-coded defaults).
	if ( empty( $items ) || ! is_array( $items ) ) {
		$items = hl_insider_resolved_items();
	}

	// Normalise booleans.
	$show_badge    = filter_var( $atts['show_badge'], FILTER_VALIDATE_BOOLEAN );
	$show_schedule = filter_var( $atts['show_schedule'], FILTER_VALIDATE_BOOLEAN );
	$show_proof    = filter_var( $atts['show_proof'], FILTER_VALIDATE_BOOLEAN );
	$cta_new_tab   = filter_var( $atts['cta_new_tab'], FILTER_VALIDATE_BOOLEAN );
	$fixed_height  = filter_var( $atts['fixed_height'], FILTER_VALIDATE_BOOLEAN );

	// Colours.
	$navy   = hl_insider_sanitize_color( $atts['color_navy'], $d['color_navy'] );
	$accent = hl_insider_sanitize_color( $atts['color_accent'], $d['color_accent'] );
	$gold   = hl_insider_sanitize_color( $atts['color_gold'], $d['color_gold'] );
	$ink    = hl_insider_sanitize_color( $atts['color_ink'], $d['color_ink'] );
	$muted  = hl_insider_sanitize_color( $atts['color_muted'], $d['color_muted'] );
	$line   = hl_insider_sanitize_color( $atts['color_line'], $d['color_line'] );

	// Numeric position values.
	$pad_left   = is_numeric( $atts['pad_left'] ) ? (float) $atts['pad_left'] : (float) $d['pad_left'];
	$offset_top = is_numeric( $atts['offset_top'] ) ? (float) $atts['offset_top'] : (float) $d['offset_top'];

	// Horizontal position within the column -> flex justification.
	$hpos_map = array(
		'left'   => 'flex-start',
		'center' => 'center',
		'right'  => 'flex-end',
	);
	$hpos_key = isset( $atts['hpos'] ) ? strtolower( (string) $atts['hpos'] ) : 'center';
	$justify  = isset( $hpos_map[ $hpos_key ] ) ? $hpos_map[ $hpos_key ] : 'center';

	// Per-instance CSS custom properties on the card (keeps the stylesheet static).
	$card_vars = sprintf(
		'--ins-navy:%1$s;--ins-accent:%2$s;--gold:%3$s;--ink:%4$s;--muted:%5$s;--line:%6$s;',
		esc_attr( $navy ),
		esc_attr( $accent ),
		esc_attr( $gold ),
		esc_attr( $ink ),
		esc_attr( $muted ),
		esc_attr( $line )
	);

	// The wrapper carries the position values so multiple instances stay independent.
	$wrap_style = sprintf(
		'--hl-pad-left:%1$spx;--hl-offset-top:%2$spx;--hl-justify:%3$s;',
		esc_attr( $pad_left ),
		esc_attr( $offset_top ),
		esc_attr( $justify )
	);

	$card_classes = 'hl-insider';
	if ( ! $fixed_height ) {
		$card_classes .= ' hl-insider--auto';
	}

	$target = $cta_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '';

	// Make sure assets are present even if render happens late (e.g. shortcode in widgets).
	hl_insider_enqueue_assets();

	ob_start();
	?>
	<div class="hl-insider-wrap" style="<?php echo esc_attr( $wrap_style ); ?>">
	<aside class="<?php echo esc_attr( $card_classes ); ?>" style="<?php echo esc_attr( $card_vars ); ?>">
	  <div class="pad">
		<?php if ( $show_badge ) : ?>
		<div class="badge"><span class="b1"><?php echo esc_html( $atts['badge_top'] ); ?></span><span class="b2"><?php echo esc_html( $atts['badge_bottom'] ); ?></span></div>
		<?php endif; ?>
		<div class="lbl"><?php echo esc_html( $atts['eyebrow'] ); ?></div>
		<h2><?php echo wp_kses( hl_insider_format_headline( $atts['headline'] ), array( 'br' => array() ) ); ?></h2>
		<p class="sub"><?php echo esc_html( $atts['subhead'] ); ?></p>
		<a class="cta" href="<?php echo esc_url( $atts['cta_url'] ); ?>"<?php echo $target; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static, escaped above. ?>><?php echo esc_html( $atts['cta_text'] ); ?> <span class="arr">&rarr;</span></a>
	  </div>
	  <div class="div"></div>
	  <div class="week">
		<div class="wlabel"><span class="dot"></span> <?php echo esc_html( $atts['week_label'] ); ?></div>
		<ul>
		<?php foreach ( $items as $item ) : ?>
		  <?php
			$item_text = isset( $item['text'] ) ? $item['text'] : '';
			if ( '' === trim( (string) $item_text ) ) {
				continue;
			}
			$item_icon = isset( $item['icon'] ) ? $item['icon'] : 'lines';
			?>
		  <li><div class="t"><span class="ico"><svg viewBox="0 0 24 24"><?php echo hl_insider_icon_svg( $item_icon ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- internal static SVG map. ?></svg></span><?php echo esc_html( $item_text ); ?></div></li>
		<?php endforeach; ?>
		</ul>
	  </div>
	  <?php if ( $show_schedule || $show_proof ) : ?>
	  <div class="foot">
		<?php if ( $show_schedule ) : ?>
		<div class="when"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg> <?php echo esc_html( $atts['schedule_text'] ); ?></div>
		<?php endif; ?>
		<?php if ( $show_proof ) : ?>
		<div class="proof"><svg viewBox="0 0 24 24"><path d="M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 20v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg><span><?php echo hl_insider_format_proof( $atts['proof_text'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped via wp_kses. ?></span></div>
		<?php endif; ?>
	  </div>
	  <?php endif; ?>
	</aside>
	</div>
	<?php
	return ob_get_clean();
}

/* -------------------------------------------------------------------------
 * Assets
 * ---------------------------------------------------------------------- */
/**
 * Register front-end / shared styles.
 */
function hl_insider_register_assets() {
	$css = HL_INSIDER_DIR . 'assets/insider.css';
	$ver = file_exists( $css ) ? filemtime( $css ) : HL_INSIDER_VERSION;

	wp_register_style(
		'hl-insider',
		HL_INSIDER_URL . 'assets/insider.css',
		array(),
		$ver
	);

	if ( hl_insider_load_fonts() ) {
		wp_register_style(
			'hl-insider-fonts',
			'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap',
			array(),
			null
		);
	}
}
add_action( 'init', 'hl_insider_register_assets' );

/**
 * Enqueue the (already registered) styles on demand.
 */
function hl_insider_enqueue_assets() {
	if ( ! wp_style_is( 'hl-insider', 'registered' ) ) {
		hl_insider_register_assets();
	}
	wp_enqueue_style( 'hl-insider' );
	if ( hl_insider_load_fonts() ) {
		wp_enqueue_style( 'hl-insider-fonts' );
	}
}

/* -------------------------------------------------------------------------
 * Shortcode
 * ---------------------------------------------------------------------- */
/**
 * [insider_panel] shortcode. Accepts scalar atts plus item_1..item_8 /
 * icon_1..icon_8.
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function hl_insider_shortcode( $atts ) {
	$d = hl_insider_defaults();

	// Build the full default list (scalars + item/icon slots) for shortcode_atts.
	$slot_defaults = array();
	for ( $i = 1; $i <= 8; $i++ ) {
		$slot_defaults[ 'item_' . $i ] = '';
		$slot_defaults[ 'icon_' . $i ] = '';
	}

	$atts = shortcode_atts( array_merge( $d, $slot_defaults ), $atts, 'insider_panel' );

	// Collect items from the slots.
	$items = array();
	for ( $i = 1; $i <= 8; $i++ ) {
		$text = trim( (string) $atts[ 'item_' . $i ] );
		if ( '' === $text ) {
			continue;
		}
		$icon = sanitize_key( $atts[ 'icon_' . $i ] );
		$items[] = array(
			'text' => $text,
			'icon' => $icon ? $icon : 'lines',
		);
		unset( $atts[ 'item_' . $i ], $atts[ 'icon_' . $i ] );
	}
	// Drop any leftover slot keys before passing scalars on.
	for ( $i = 1; $i <= 8; $i++ ) {
		unset( $atts[ 'item_' . $i ], $atts[ 'icon_' . $i ] );
	}

	return hl_insider_render( $atts, $items );
}
add_shortcode( 'insider_panel', 'hl_insider_shortcode' );

/* -------------------------------------------------------------------------
 * Block
 * ---------------------------------------------------------------------- */
/**
 * Block render callback — normalises attributes then defers to the shared
 * render function.
 *
 * @param array $attributes Block attributes.
 * @return string
 */
function hl_insider_render_block( $attributes ) {
	$attributes = is_array( $attributes ) ? $attributes : array();

	// When "use global settings" is on (the default), ignore this block's own
	// fields entirely and render from the dashboard values. This makes the
	// dashboard the single source of truth across the whole site.
	$use_global = ! array_key_exists( 'use_global', $attributes )
		|| filter_var( $attributes['use_global'], FILTER_VALIDATE_BOOLEAN );
	if ( $use_global ) {
		return hl_insider_render( array(), array() );
	}

	// Items come through as an array of { text, icon }.
	$items = array();
	if ( ! empty( $attributes['items'] ) && is_array( $attributes['items'] ) ) {
		foreach ( $attributes['items'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$text = isset( $row['text'] ) ? trim( (string) $row['text'] ) : '';
			if ( '' === $text ) {
				continue;
			}
			$items[] = array(
				'text' => $text,
				'icon' => isset( $row['icon'] ) ? sanitize_key( $row['icon'] ) : 'lines',
			);
		}
	}

	return hl_insider_render( $attributes, $items );
}

/**
 * Register the dynamic block from block.json.
 */
function hl_insider_register_block() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return; // Old WP without block support.
	}
	register_block_type(
		HL_INSIDER_DIR . 'blocks/insider-panel',
		array(
			'render_callback' => 'hl_insider_render_block',
		)
	);
}
add_action( 'init', 'hl_insider_register_block' );

/**
 * Enqueue the no-build editor script + data it needs (icons, defaults).
 */
function hl_insider_enqueue_editor_assets() {
	$js  = HL_INSIDER_DIR . 'blocks/insider-panel/edit.js';
	$ver = file_exists( $js ) ? filemtime( $js ) : HL_INSIDER_VERSION;

	wp_enqueue_script(
		'hl-insider-edit',
		HL_INSIDER_URL . 'blocks/insider-panel/edit.js',
		array(
			'wp-blocks',
			'wp-element',
			'wp-block-editor',
			'wp-components',
			'wp-server-side-render',
			'wp-i18n',
		),
		$ver,
		true
	);

	// Build icon option list for the dropdown.
	$labels  = hl_insider_icon_labels();
	$options = array();
	foreach ( $labels as $key => $label ) {
		$options[] = array(
			'value' => $key,
			'label' => $label,
		);
	}

	wp_localize_script(
		'hl-insider-edit',
		'HLInsiderData',
		array(
			'iconOptions'  => $options,
			'defaultItems' => hl_insider_default_items(),
		)
	);

	// Editor also needs the panel styles + fonts for an accurate preview.
	hl_insider_enqueue_assets();
}
add_action( 'enqueue_block_editor_assets', 'hl_insider_enqueue_editor_assets' );

/**
 * Load translations.
 */
function hl_insider_load_textdomain() {
	load_plugin_textdomain( 'hl-insider', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'init', 'hl_insider_load_textdomain' );
