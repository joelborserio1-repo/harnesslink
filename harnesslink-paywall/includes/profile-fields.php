<?php
/**
 * HarnessLink PayWall — capture First name, Last name and (optional) Mobile
 * on the Leaky Paywall List Builder signup step.
 *
 * The List Builder signup step only collects email + password, and its
 * handler hard-codes an empty first/last name — so we both ADD the fields
 * and SAVE them ourselves, using LP's public hooks (no core edits):
 *   - lp_list_builder_signup_form_fields  (render the inputs)
 *   - lp_list_builder_signup_validation   (require first/last, capture values)
 *   - leaky_paywall_after_process_registration (persist to the user)
 *
 * The JS (assets/harnesslink-paywall.js) moves these rows above the password
 * field for a natural form order.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Per-request capture of profile values, keyed by email. */
final class HLPW_Profile_Capture {
	/** @var array<string,array{first_name:string,last_name:string,phone:string}> */
	public static $pending = array();
}

/* ------------------------------------------------------------------ *
 * 1. Render the fields (priority 5 so they sit above the Insider box).
 * ------------------------------------------------------------------ */
add_action( 'lp_list_builder_signup_form_fields', function () {
	?>
	<div class="Slider__InputRow hlpw-field hlpw-field--first">
		<label for="hlpw-first-name"><?php esc_html_e( 'First Name', 'harnesslink-paywall' ); ?></label>
		<div class="TextField">
			<input type="text" id="hlpw-first-name" name="first_name" required autocomplete="given-name" />
		</div>
	</div>

	<div class="Slider__InputRow hlpw-field hlpw-field--last">
		<label for="hlpw-last-name"><?php esc_html_e( 'Last Name', 'harnesslink-paywall' ); ?></label>
		<div class="TextField">
			<input type="text" id="hlpw-last-name" name="last_name" required autocomplete="family-name" />
		</div>
	</div>

	<div class="Slider__InputRow hlpw-field hlpw-field--phone">
		<label for="hlpw-phone"><?php esc_html_e( 'Mobile number (optional)', 'harnesslink-paywall' ); ?></label>
		<div class="TextField">
			<input type="tel" id="hlpw-phone" name="hlpw_phone" autocomplete="tel" inputmode="tel" />
		</div>
	</div>
	<?php
}, 5 );

/* ------------------------------------------------------------------ *
 * 2. Require first/last name + capture all three for saving.
 * ------------------------------------------------------------------ */
add_filter( 'lp_list_builder_signup_validation', function ( $error, $request ) {
	if ( ! empty( $error ) ) {
		return $error; // respect an earlier validation error
	}

	$first = trim( (string) $request->get_param( 'first_name' ) );
	$last  = trim( (string) $request->get_param( 'last_name' ) );

	if ( '' === $first || '' === $last ) {
		return __( 'Please enter your first and last name.', 'harnesslink-paywall' );
	}

	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	if ( $email ) {
		HLPW_Profile_Capture::$pending[ $email ] = array(
			'first_name' => sanitize_text_field( $first ),
			'last_name'  => sanitize_text_field( $last ),
			'phone'      => sanitize_text_field( (string) $request->get_param( 'hlpw_phone' ) ),
		);
	}

	return '';
}, 10, 2 );

/* ------------------------------------------------------------------ *
 * 3. Persist to the new user.
 * ------------------------------------------------------------------ */
add_action( 'leaky_paywall_after_process_registration', function ( $subscriber_data ) {
	$user_id = is_array( $subscriber_data ) && ! empty( $subscriber_data['user_id'] ) ? (int) $subscriber_data['user_id'] : 0;
	if ( ! $user_id ) {
		return;
	}

	$user  = get_userdata( $user_id );
	$email = $user ? $user->user_email : '';
	if ( ! $email || empty( HLPW_Profile_Capture::$pending[ $email ] ) ) {
		return;
	}

	$data = HLPW_Profile_Capture::$pending[ $email ];

	wp_update_user(
		array(
			'ID'           => $user_id,
			'first_name'   => $data['first_name'],
			'last_name'    => $data['last_name'],
			'display_name' => trim( $data['first_name'] . ' ' . $data['last_name'] ),
		)
	);

	if ( ! empty( $data['phone'] ) ) {
		update_user_meta( $user_id, '_hlpw_phone', $data['phone'] );
		// Common convention many plugins/exporters read.
		update_user_meta( $user_id, 'billing_phone', $data['phone'] );
	}
}, 5 );
