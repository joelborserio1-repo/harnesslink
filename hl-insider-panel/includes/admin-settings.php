<?php
/**
 * Admin dashboard for HarnessLink Insider Panel.
 *
 * Adds a top-level "Insider Panel" menu where the team edits every line of
 * content, the "this week" items, colours and positioning in one place. The
 * values are stored in the single option `hl_insider_settings` and become the
 * defaults used by the block and shortcode.
 *
 * @package HL_Insider_Panel
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const HL_INSIDER_OPTION = 'hl_insider_settings';

/**
 * Register the admin menu page.
 */
function hl_insider_admin_menu() {
	add_menu_page(
		__( 'Insider Panel', 'hl-insider' ),
		__( 'Insider Panel', 'hl-insider' ),
		'manage_options',
		'hl-insider',
		'hl_insider_render_settings_page',
		'dashicons-megaphone',
		58
	);
}
add_action( 'admin_menu', 'hl_insider_admin_menu' );

/**
 * Load the panel stylesheet (and fonts) on our settings screen so the live
 * preview renders correctly.
 *
 * @param string $hook Current admin page hook.
 */
function hl_insider_admin_assets( $hook ) {
	if ( 'toplevel_page_hl-insider' !== $hook ) {
		return;
	}
	hl_insider_enqueue_assets();
}
add_action( 'admin_enqueue_scripts', 'hl_insider_admin_assets' );

/**
 * Register the option + sanitizer with the Settings API.
 */
function hl_insider_register_settings() {
	register_setting(
		'hl_insider_group',
		HL_INSIDER_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'hl_insider_sanitize_settings',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'hl_insider_register_settings' );

/**
 * Sanitize the entire settings payload before it is saved.
 *
 * @param array $input Raw POSTed values.
 * @return array
 */
function hl_insider_sanitize_settings( $input ) {
	$input = is_array( $input ) ? $input : array();
	$base  = hl_insider_base_defaults();
	$out   = array();

	// Plain text scalars.
	$text_fields = array( 'eyebrow', 'badge_top', 'badge_bottom', 'cta_text', 'week_label', 'schedule_text', 'subhead', 'proof_text' );
	foreach ( $text_fields as $key ) {
		$out[ $key ] = isset( $input[ $key ] ) ? sanitize_text_field( wp_unslash( $input[ $key ] ) ) : $base[ $key ];
	}

	// Headline keeps line breaks.
	$out['headline'] = isset( $input['headline'] )
		? sanitize_textarea_field( wp_unslash( $input['headline'] ) )
		: $base['headline'];

	// URL.
	$out['cta_url'] = isset( $input['cta_url'] ) ? esc_url_raw( wp_unslash( $input['cta_url'] ) ) : $base['cta_url'];

	// Booleans (unchecked checkboxes are simply absent).
	$bools = array( 'show_badge', 'cta_new_tab', 'show_schedule', 'show_proof', 'fixed_height' );
	foreach ( $bools as $key ) {
		$out[ $key ] = ! empty( $input[ $key ] ) ? true : false;
	}

	// Position numbers.
	$out['pad_left']   = isset( $input['pad_left'] ) ? (int) $input['pad_left'] : $base['pad_left'];
	$out['offset_top'] = isset( $input['offset_top'] ) ? (int) $input['offset_top'] : $base['offset_top'];

	// Horizontal position.
	$hpos        = isset( $input['hpos'] ) ? sanitize_key( $input['hpos'] ) : $base['hpos'];
	$out['hpos'] = in_array( $hpos, array( 'left', 'center', 'right' ), true ) ? $hpos : 'center';

	// Colours.
	foreach ( array( 'color_navy', 'color_accent', 'color_gold', 'color_ink', 'color_muted', 'color_line' ) as $key ) {
		$val           = isset( $input[ $key ] ) ? wp_unslash( $input[ $key ] ) : $base[ $key ];
		$out[ $key ]   = hl_insider_sanitize_color( $val, $base[ $key ] );
	}

	// Items (up to 8).
	$valid_icons = array_keys( hl_insider_icons() );
	$items       = array();
	if ( isset( $input['items'] ) && is_array( $input['items'] ) ) {
		foreach ( $input['items'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$text = isset( $row['text'] ) ? sanitize_text_field( wp_unslash( $row['text'] ) ) : '';
			if ( '' === trim( $text ) ) {
				continue; // Skip blank rows.
			}
			$icon    = isset( $row['icon'] ) ? sanitize_key( $row['icon'] ) : 'lines';
			$items[] = array(
				'text' => $text,
				'icon' => in_array( $icon, $valid_icons, true ) ? $icon : 'lines',
			);
			if ( count( $items ) >= 8 ) {
				break;
			}
		}
	}
	$out['items'] = $items;

	return $out;
}

/**
 * Render the settings page.
 */
function hl_insider_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	// Current values (saved over base defaults) + items.
	$v     = hl_insider_defaults();
	$items = hl_insider_resolved_items();

	$icon_labels = hl_insider_icon_labels();
	?>
	<div class="wrap hl-insider-admin">
		<h1><?php esc_html_e( 'Insider Panel', 'hl-insider' ); ?></h1>
		<p class="description">
			<?php esc_html_e( 'Edit the panel here. These values are used everywhere the Insider Panel block (with "Use global settings" on) or the [insider_panel] shortcode appears.', 'hl-insider' ); ?>
		</p>

		<form method="post" action="options.php">
			<?php settings_fields( 'hl_insider_group' ); ?>

			<h2 class="title"><?php esc_html_e( 'Content', 'hl-insider' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php
				hl_insider_text_row( 'eyebrow', __( 'Eyebrow (small label)', 'hl-insider' ), $v['eyebrow'] );
				?>
				<tr>
					<th scope="row"><label for="hl_headline"><?php esc_html_e( 'Headline', 'hl-insider' ); ?></label></th>
					<td>
						<textarea id="hl_headline" name="<?php echo esc_attr( HL_INSIDER_OPTION ); ?>[headline]" rows="2" class="large-text"><?php echo esc_textarea( $v['headline'] ); ?></textarea>
						<p class="description"><?php esc_html_e( 'Press Enter for the line break.', 'hl-insider' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="hl_subhead"><?php esc_html_e( 'Subhead', 'hl-insider' ); ?></label></th>
					<td><textarea id="hl_subhead" name="<?php echo esc_attr( HL_INSIDER_OPTION ); ?>[subhead]" rows="2" class="large-text"><?php echo esc_textarea( $v['subhead'] ); ?></textarea></td>
				</tr>
			</table>

			<h2 class="title"><?php esc_html_e( 'Badge', 'hl-insider' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php
				hl_insider_checkbox_row( 'show_badge', __( 'Show badge', 'hl-insider' ), $v['show_badge'] );
				hl_insider_text_row( 'badge_top', __( 'Badge top text', 'hl-insider' ), $v['badge_top'] );
				hl_insider_text_row( 'badge_bottom', __( 'Badge bottom text', 'hl-insider' ), $v['badge_bottom'] );
				?>
			</table>

			<h2 class="title"><?php esc_html_e( 'Call to action', 'hl-insider' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php
				hl_insider_text_row( 'cta_text', __( 'Button text', 'hl-insider' ), $v['cta_text'] );
				hl_insider_text_row( 'cta_url', __( 'Button URL', 'hl-insider' ), $v['cta_url'], 'url' );
				hl_insider_checkbox_row( 'cta_new_tab', __( 'Open in a new tab', 'hl-insider' ), $v['cta_new_tab'] );
				?>
			</table>

			<h2 class="title"><?php esc_html_e( 'This week items', 'hl-insider' ); ?></h2>
			<p class="description"><?php esc_html_e( 'Up to 8 rows. Leave a row blank to remove it.', 'hl-insider' ); ?></p>
			<table class="form-table hl-insider-items" role="presentation">
				<?php
				for ( $i = 0; $i < 8; $i++ ) :
					$row_text = isset( $items[ $i ]['text'] ) ? $items[ $i ]['text'] : '';
					$row_icon = isset( $items[ $i ]['icon'] ) ? $items[ $i ]['icon'] : 'lines';
					$name     = HL_INSIDER_OPTION . '[items][' . $i . ']';
					?>
					<tr>
						<th scope="row"><?php /* translators: %d: row number */ printf( esc_html__( 'Item %d', 'hl-insider' ), (int) ( $i + 1 ) ); ?></th>
						<td>
							<input type="text" class="regular-text" style="width:60%" name="<?php echo esc_attr( $name ); ?>[text]" value="<?php echo esc_attr( $row_text ); ?>" placeholder="<?php esc_attr_e( 'Item text', 'hl-insider' ); ?>" />
							<select name="<?php echo esc_attr( $name ); ?>[icon]">
								<?php foreach ( $icon_labels as $key => $label ) : ?>
									<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $row_icon, $key ); ?>><?php echo esc_html( $label ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
				<?php endfor; ?>
			</table>

			<h2 class="title"><?php esc_html_e( 'Footer', 'hl-insider' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php
				hl_insider_checkbox_row( 'show_schedule', __( 'Show schedule line', 'hl-insider' ), $v['show_schedule'] );
				hl_insider_text_row( 'schedule_text', __( 'Schedule text', 'hl-insider' ), $v['schedule_text'] );
				hl_insider_checkbox_row( 'show_proof', __( 'Show proof line', 'hl-insider' ), $v['show_proof'] );
				?>
				<tr>
					<th scope="row"><label for="hl_proof_text"><?php esc_html_e( 'Proof text', 'hl-insider' ); ?></label></th>
					<td>
						<input type="text" id="hl_proof_text" class="large-text" name="<?php echo esc_attr( HL_INSIDER_OPTION ); ?>[proof_text]" value="<?php echo esc_attr( $v['proof_text'] ); ?>" />
						<p class="description"><?php esc_html_e( 'Wrap text in **double asterisks** to bold it; otherwise the first number is bolded automatically.', 'hl-insider' ); ?></p>
					</td>
				</tr>
			</table>

			<h2 class="title"><?php esc_html_e( 'Position &amp; spacing', 'hl-insider' ); ?></h2>
			<p class="description"><?php esc_html_e( 'Use these to tighten the gaps and move the panel closer to your other content.', 'hl-insider' ); ?></p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="hl_hpos"><?php esc_html_e( 'Horizontal position', 'hl-insider' ); ?></label></th>
					<td>
						<select id="hl_hpos" name="<?php echo esc_attr( HL_INSIDER_OPTION ); ?>[hpos]">
							<option value="left"   <?php selected( $v['hpos'], 'left' ); ?>><?php esc_html_e( 'Left (hug the left edge)', 'hl-insider' ); ?></option>
							<option value="center" <?php selected( $v['hpos'], 'center' ); ?>><?php esc_html_e( 'Center', 'hl-insider' ); ?></option>
							<option value="right"  <?php selected( $v['hpos'], 'right' ); ?>><?php esc_html_e( 'Right', 'hl-insider' ); ?></option>
						</select>
						<p class="description"><?php esc_html_e( 'Choose "Left" to sit it right next to the widget on its left.', 'hl-insider' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="hl_pad_left"><?php esc_html_e( 'Left gutter (px)', 'hl-insider' ); ?></label></th>
					<td>
						<input type="number" id="hl_pad_left" name="<?php echo esc_attr( HL_INSIDER_OPTION ); ?>[pad_left]" value="<?php echo esc_attr( $v['pad_left'] ); ?>" min="-100" max="200" step="1" />
						<p class="description"><?php esc_html_e( 'Lower this (or use a negative number) to pull the panel left, closer to the next widget. Default 20.', 'hl-insider' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="hl_offset_top"><?php esc_html_e( 'Vertical offset (px)', 'hl-insider' ); ?></label></th>
					<td>
						<input type="number" id="hl_offset_top" name="<?php echo esc_attr( HL_INSIDER_OPTION ); ?>[offset_top]" value="<?php echo esc_attr( $v['offset_top'] ); ?>" min="-200" max="200" step="1" />
						<p class="description"><?php esc_html_e( 'Use a negative number to pull the panel up and close the gap to the widget above it. Default 0.', 'hl-insider' ); ?></p>
					</td>
				</tr>
				<?php hl_insider_checkbox_row( 'fixed_height', __( 'Fixed height on desktop (537px)', 'hl-insider' ), $v['fixed_height'] ); ?>
			</table>

			<h2 class="title"><?php esc_html_e( 'Colors', 'hl-insider' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php
				hl_insider_color_row( 'color_navy', __( 'Navy', 'hl-insider' ), $v['color_navy'] );
				hl_insider_color_row( 'color_accent', __( 'Accent', 'hl-insider' ), $v['color_accent'] );
				hl_insider_color_row( 'color_gold', __( 'Gold', 'hl-insider' ), $v['color_gold'] );
				hl_insider_color_row( 'color_ink', __( 'Ink (headings)', 'hl-insider' ), $v['color_ink'] );
				hl_insider_color_row( 'color_muted', __( 'Muted text', 'hl-insider' ), $v['color_muted'] );
				hl_insider_color_row( 'color_line', __( 'Lines / borders', 'hl-insider' ), $v['color_line'] );
				?>
			</table>

			<?php submit_button( __( 'Save changes', 'hl-insider' ) ); ?>
		</form>

		<hr>
		<h2><?php esc_html_e( 'Live preview', 'hl-insider' ); ?></h2>
		<p class="description"><?php esc_html_e( 'Reflects your last saved settings.', 'hl-insider' ); ?></p>
		<div style="max-width:480px;"><?php echo hl_insider_render(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render output is escaped internally. ?></div>
	</div>
	<?php
}

/* ---- Small field helpers (admin only) -------------------------------- */

/**
 * Render a text input row.
 *
 * @param string $key   Option sub-key.
 * @param string $label Field label.
 * @param string $value Current value.
 * @param string $type  Input type.
 */
function hl_insider_text_row( $key, $label, $value, $type = 'text' ) {
	$id   = 'hl_' . $key;
	$name = HL_INSIDER_OPTION . '[' . $key . ']';
	?>
	<tr>
		<th scope="row"><label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label></th>
		<td><input type="<?php echo esc_attr( $type ); ?>" id="<?php echo esc_attr( $id ); ?>" class="regular-text" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $value ); ?>" /></td>
	</tr>
	<?php
}

/**
 * Render a checkbox row.
 *
 * @param string $key     Option sub-key.
 * @param string $label   Field label.
 * @param bool   $checked Current state.
 */
function hl_insider_checkbox_row( $key, $label, $checked ) {
	$id   = 'hl_' . $key;
	$name = HL_INSIDER_OPTION . '[' . $key . ']';
	?>
	<tr>
		<th scope="row"><?php echo esc_html( $label ); ?></th>
		<td>
			<label for="<?php echo esc_attr( $id ); ?>">
				<input type="checkbox" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="1" <?php checked( (bool) $checked ); ?> />
				<?php esc_html_e( 'Enabled', 'hl-insider' ); ?>
			</label>
		</td>
	</tr>
	<?php
}

/**
 * Render a colour input row (native colour picker + text).
 *
 * @param string $key   Option sub-key.
 * @param string $label Field label.
 * @param string $value Current hex value.
 */
function hl_insider_color_row( $key, $label, $value ) {
	$id   = 'hl_' . $key;
	$name = HL_INSIDER_OPTION . '[' . $key . ']';
	?>
	<tr>
		<th scope="row"><label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label></th>
		<td><input type="color" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( $value ); ?>" /> <code><?php echo esc_html( $value ); ?></code></td>
	</tr>
	<?php
}
