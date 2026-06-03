<?php
/**
 * HarnessLink PayWall — "The Insider" newsletter opt-in.
 *
 * Adds a pre-ticked opt-in checkbox to the Leaky Paywall List Builder signup
 * step, stores the choice on the WordPress user, and provides a CSV export
 * (Users -> Insider Opt-ins) for manual import into Mailchimp.
 *
 * Implemented entirely with Leaky Paywall's public hooks — no core edits:
 *   - lp_list_builder_signup_form_fields  (render the checkbox into the form)
 *   - lp_list_builder_signup_validation   (capture the posted value + request)
 *   - leaky_paywall_after_process_registration (persist it on the new user)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** User meta keys. */
const HLPW_INSIDER_META      = '_hlpw_insider_optin';      // 'yes' | 'no'
const HLPW_INSIDER_DATE_META = '_hlpw_insider_optin_date'; // mysql datetime

/**
 * Per-request capture of the opt-in choice, keyed by email.
 * The signup REST request validates (where we can read the request) before the
 * user exists, then fires the registration action (where the user_id exists).
 */
final class HLPW_Insider_Capture {
	/** @var array<string,bool> email => opted-in */
	public static $pending = array();
}

/* ------------------------------------------------------------------ *
 * 1. Render the checkbox into the List Builder "Create account" step.
 *    Pre-ticked. Unticked checkboxes simply aren't posted, so absence
 *    = declined.
 * ------------------------------------------------------------------ */
add_action( 'lp_list_builder_signup_form_fields', function ( $email ) {

	// ----------------------------------------------------------------
	// EDIT THIS COPY — the "don't miss out" opt-in line shown by the box.
	// (Also overridable via the 'hlpw_insider_optin_label' filter.)
	// ----------------------------------------------------------------
	$label = "Don't miss out — send me The Insider, our free weekly harness racing newsletter.";

	$label   = apply_filters( 'hlpw_insider_optin_label', $label, $email );
	$checked = apply_filters( 'hlpw_insider_optin_default_checked', true ) ? ' checked' : '';
	?>
	<div class="Slider__InputRow hlpw-insider-optin">
		<label class="hlpw-insider-optin__label">
			<input type="checkbox" name="insider_optin" value="yes"<?php echo $checked; ?> />
			<span><?php echo esc_html( $label ); ?></span>
		</label>
	</div>
	<?php
} );

/* ------------------------------------------------------------------ *
 * 2. Capture the posted value during signup validation (has the request).
 *    We don't add a validation error; just read and stash, return as-is.
 * ------------------------------------------------------------------ */
add_filter( 'lp_list_builder_signup_validation', function ( $error, $request ) {
	$email = sanitize_email( (string) $request->get_param( 'email' ) );

	if ( $email ) {
		HLPW_Insider_Capture::$pending[ $email ] = ( 'yes' === $request->get_param( 'insider_optin' ) );
	}

	return $error; // unchanged — do not block registration
}, 10, 2 );

/* ------------------------------------------------------------------ *
 * 3. Persist the choice on the new user once it exists.
 * ------------------------------------------------------------------ */
add_action( 'leaky_paywall_after_process_registration', function ( $subscriber_data ) {
	$user_id = is_array( $subscriber_data ) && ! empty( $subscriber_data['user_id'] ) ? (int) $subscriber_data['user_id'] : 0;

	if ( ! $user_id ) {
		return;
	}

	$user  = get_userdata( $user_id );
	$email = $user ? $user->user_email : '';

	$opted = $email && ! empty( HLPW_Insider_Capture::$pending[ $email ] );

	update_user_meta( $user_id, HLPW_INSIDER_META, $opted ? 'yes' : 'no' );

	if ( $opted ) {
		update_user_meta( $user_id, HLPW_INSIDER_DATE_META, current_time( 'mysql' ) );
	}

	/**
	 * Fires after the Insider opt-in is stored. Hook here later to push
	 * straight to Mailchimp's API if you move off manual import.
	 */
	do_action( 'hlpw_insider_optin_saved', $user_id, $opted );
} );

/* ------------------------------------------------------------------ *
 * 4. Admin: Users -> Insider Opt-ins (count + CSV export for Mailchimp).
 * ------------------------------------------------------------------ */
add_action( 'admin_menu', function () {
	add_users_page(
		__( 'Insider Opt-ins', 'harnesslink-paywall' ),
		__( 'Insider Opt-ins', 'harnesslink-paywall' ),
		'manage_options',
		'hlpw-insider-optins',
		'hlpw_render_insider_optins_page'
	);
} );

/** Count of opted-in users. */
function hlpw_insider_optin_count() {
	$ids = get_users(
		array(
			'meta_key'   => HLPW_INSIDER_META,
			'meta_value' => 'yes',
			'fields'     => 'ID',
		)
	);
	return count( $ids );
}

/** Admin page body. */
function hlpw_render_insider_optins_page() {
	$count      = hlpw_insider_optin_count();
	$export_url = wp_nonce_url( admin_url( 'admin-post.php?action=hlpw_export_insider' ), 'hlpw_export_insider' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'The Insider — Opt-ins', 'harnesslink-paywall' ); ?></h1>
		<p>
			<strong><?php echo (int) $count; ?></strong>
			<?php esc_html_e( 'subscriber(s) have opted in to The Insider.', 'harnesslink-paywall' ); ?>
		</p>
		<p>
			<a class="button button-primary" href="<?php echo esc_url( $export_url ); ?>">
				<?php esc_html_e( 'Export CSV for Mailchimp', 'harnesslink-paywall' ); ?>
			</a>
		</p>
		<p class="description">
			<?php esc_html_e( 'Then in Mailchimp: Audience → Import contacts → Upload file. Columns are Email Address, First Name, Last Name.', 'harnesslink-paywall' ); ?>
		</p>
	</div>
	<?php
}

/** Stream the opted-in users as a Mailchimp-friendly CSV. */
add_action( 'admin_post_hlpw_export_insider', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to export.', 'harnesslink-paywall' ) );
	}
	check_admin_referer( 'hlpw_export_insider' );

	$users = get_users(
		array(
			'meta_key'   => HLPW_INSIDER_META,
			'meta_value' => 'yes',
			'orderby'    => 'user_registered',
			'order'      => 'DESC',
		)
	);

	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename=insider-optins-' . gmdate( 'Y-m-d' ) . '.csv' );

	$out = fopen( 'php://output', 'w' );
	fputcsv( $out, array( 'Email Address', 'First Name', 'Last Name', 'Opted In Date' ) );

	foreach ( $users as $user ) {
		$date = get_user_meta( $user->ID, HLPW_INSIDER_DATE_META, true );
		fputcsv(
			$out,
			array(
				$user->user_email,
				get_user_meta( $user->ID, 'first_name', true ),
				get_user_meta( $user->ID, 'last_name', true ),
				$date ? $date : $user->user_registered,
			)
		);
	}

	fclose( $out );
	exit;
} );
