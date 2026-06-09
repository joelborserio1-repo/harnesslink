<?php
/**
 * HarnessLink PayWall — "The Insider" newsletter opt-in: storage + export.
 *
 * The opt-in checkbox itself is now collected in the post-signup
 * "complete your profile" prompt (includes/profile-completion.php), not at
 * the wall — so the wall stays a minimal email signup. This file owns the
 * meta keys, the admin "Insider Opt-ins" page, and the CSV export for
 * manual Mailchimp import.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** User meta keys. */
const HLPW_INSIDER_META      = '_hlpw_insider_optin';      // 'yes' | 'no'
const HLPW_INSIDER_DATE_META = '_hlpw_insider_optin_date'; // mysql datetime

/* ------------------------------------------------------------------ *
 * Admin: Users -> Insider Opt-ins (count + CSV export for Mailchimp).
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
			<?php esc_html_e( 'Then in Mailchimp: Audience → Import contacts → Upload file. Columns are Email Address, First Name, Last Name, Phone.', 'harnesslink-paywall' ); ?>
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
	fputcsv( $out, array( 'Email Address', 'First Name', 'Last Name', 'Phone', 'Opted In Date' ) );

	foreach ( $users as $user ) {
		$date = get_user_meta( $user->ID, HLPW_INSIDER_DATE_META, true );
		fputcsv(
			$out,
			array(
				$user->user_email,
				get_user_meta( $user->ID, 'first_name', true ),
				get_user_meta( $user->ID, 'last_name', true ),
				get_user_meta( $user->ID, '_hlpw_phone', true ),
				$date ? $date : $user->user_registered,
			)
		);
	}

	fclose( $out );
	exit;
} );
