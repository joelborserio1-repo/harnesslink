<?php
/**
 * HarnessLink PayWall — post-signup "complete your profile" prompt.
 *
 * The wall now only takes an email + password (lowest friction). Once the
 * member is logged in, this shows a small, dismissible prompt asking for
 * First/Last name, optional Mobile, and the (pre-ticked) Insider newsletter
 * opt-in — saved via AJAX to the WordPress user.
 *
 * Shown only to logged-in, non-staff members who haven't completed it.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Profile-complete flag. */
const HLPW_PROFILE_COMPLETE_META = '_hlpw_profile_complete';

/** Should the current visitor see the prompt? */
function hlpw_should_show_profile_prompt() {
	if ( ! is_user_logged_in() ) {
		return false;
	}
	// Don't nag staff/editors.
	if ( current_user_can( 'edit_posts' ) ) {
		return false;
	}
	return 'yes' !== get_user_meta( get_current_user_id(), HLPW_PROFILE_COMPLETE_META, true );
}

/* ------------------------------------------------------------------ *
 * Render the prompt in the footer.
 * ------------------------------------------------------------------ */
add_action( 'wp_footer', function () {
	if ( ! hlpw_should_show_profile_prompt() ) {
		return;
	}

	$uid       = get_current_user_id();
	$first     = get_user_meta( $uid, 'first_name', true );
	$last      = get_user_meta( $uid, 'last_name', true );
	$phone     = get_user_meta( $uid, '_hlpw_phone', true );
	$optin_raw = get_user_meta( $uid, HLPW_INSIDER_META, true );
	$optin_chk = ( 'no' === $optin_raw ) ? '' : ' checked'; // pre-ticked for new members

	// ----------------------------------------------------------------
	// EDIT THIS COPY — newsletter opt-in line in the profile prompt.
	// ----------------------------------------------------------------
	$insider_label = "Send me The Insider — our free weekly harness racing newsletter.";
	?>
	<div id="hlpw-profile-prompt" class="hlpw-profile-prompt" role="dialog" aria-label="<?php esc_attr_e( 'Complete your profile', 'harnesslink-paywall' ); ?>">
		<button type="button" class="hlpw-pp-close" aria-label="<?php esc_attr_e( 'Close', 'harnesslink-paywall' ); ?>">&times;</button>
		<h3 class="hlpw-pp-title"><?php esc_html_e( 'Welcome to HarnessLink!', 'harnesslink-paywall' ); ?></h3>
		<p class="hlpw-pp-sub"><?php esc_html_e( 'Add a few details so we can tailor your harness racing news.', 'harnesslink-paywall' ); ?></p>

		<form id="hlpw-profile-form" class="hlpw-pp-form">
			<div class="hlpw-pp-row">
				<label for="hlpw-pp-first"><?php esc_html_e( 'First name', 'harnesslink-paywall' ); ?></label>
				<input type="text" id="hlpw-pp-first" name="first_name" value="<?php echo esc_attr( $first ); ?>" autocomplete="given-name" />
			</div>
			<div class="hlpw-pp-row">
				<label for="hlpw-pp-last"><?php esc_html_e( 'Last name', 'harnesslink-paywall' ); ?></label>
				<input type="text" id="hlpw-pp-last" name="last_name" value="<?php echo esc_attr( $last ); ?>" autocomplete="family-name" />
			</div>
			<div class="hlpw-pp-row">
				<label for="hlpw-pp-phone"><?php esc_html_e( 'Mobile number', 'harnesslink-paywall' ); ?> <span class="hlpw-req">*</span></label>
				<input type="tel" id="hlpw-pp-phone" name="phone" value="<?php echo esc_attr( $phone ); ?>" autocomplete="tel" inputmode="tel" required />
			</div>

			<label class="hlpw-pp-check">
				<input type="checkbox" name="insider_optin" value="yes"<?php echo $optin_chk; ?> />
				<span><?php echo esc_html( $insider_label ); ?></span>
			</label>

			<?php
			$privacy_url = function_exists( 'get_privacy_policy_url' ) ? get_privacy_policy_url() : '';
			?>
			<p class="hlpw-pp-fineprint">
				<?php esc_html_e( 'You can unsubscribe anytime.', 'harnesslink-paywall' ); ?>
				<?php if ( $privacy_url ) : ?>
					<a href="<?php echo esc_url( $privacy_url ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Privacy Policy', 'harnesslink-paywall' ); ?></a>.
				<?php endif; ?>
			</p>

			<div class="hlpw-pp-actions">
				<button type="submit" class="hlpw-pp-save"><?php esc_html_e( 'Save', 'harnesslink-paywall' ); ?></button>
				<button type="button" class="hlpw-pp-skip"><?php esc_html_e( 'Maybe later', 'harnesslink-paywall' ); ?></button>
			</div>
			<div class="hlpw-pp-msg" aria-live="polite"></div>
		</form>
	</div>
	<?php
} );

/* ------------------------------------------------------------------ *
 * AJAX: save the profile.
 * ------------------------------------------------------------------ */
add_action( 'wp_ajax_hlpw_save_profile', function () {
	check_ajax_referer( 'hlpw_profile', 'nonce' );

	$uid = get_current_user_id();
	if ( ! $uid ) {
		wp_send_json_error( array( 'message' => __( 'You are not logged in.', 'harnesslink-paywall' ) ), 401 );
	}

	$first = isset( $_POST['first_name'] ) ? sanitize_text_field( wp_unslash( $_POST['first_name'] ) ) : '';
	$last  = isset( $_POST['last_name'] ) ? sanitize_text_field( wp_unslash( $_POST['last_name'] ) ) : '';
	$phone = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
	$optin = isset( $_POST['insider_optin'] ) && 'yes' === $_POST['insider_optin'];

	// Mobile is required. Reject (and don't mark the profile complete) if it's
	// missing or clearly not a phone number, so the member keeps being asked.
	$digits = preg_replace( '/\D+/', '', $phone );
	if ( strlen( $digits ) < 6 ) {
		wp_send_json_error( array( 'message' => __( 'Please enter a valid mobile number.', 'harnesslink-paywall' ) ) );
	}

	$update = array( 'ID' => $uid );
	if ( '' !== $first ) {
		$update['first_name'] = $first;
	}
	if ( '' !== $last ) {
		$update['last_name'] = $last;
	}
	if ( count( $update ) > 1 ) {
		$update['display_name'] = trim( $first . ' ' . $last );
		wp_update_user( $update );
	}

	if ( '' !== $phone ) {
		update_user_meta( $uid, '_hlpw_phone', $phone );
		update_user_meta( $uid, 'billing_phone', $phone );
	}

	update_user_meta( $uid, HLPW_INSIDER_META, $optin ? 'yes' : 'no' );
	if ( $optin ) {
		update_user_meta( $uid, HLPW_INSIDER_DATE_META, current_time( 'mysql' ) );
	}

	update_user_meta( $uid, HLPW_PROFILE_COMPLETE_META, 'yes' );

	wp_send_json_success( array( 'message' => __( 'Thanks — your profile is updated.', 'harnesslink-paywall' ) ) );
} );
