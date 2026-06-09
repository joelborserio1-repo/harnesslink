<?php
/**
 * HarnessLink PayWall — "The Insider" opt-in: storage, admin + export.
 *
 * The opt-in checkbox is collected in the post-signup "complete your profile"
 * prompt (includes/profile-completion.php). This file owns the meta keys, the
 * admin "Insider Opt-ins" page (count + CSV export, all or new-since-last),
 * and a Users-list column + filter.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** User meta keys. */
const HLPW_INSIDER_META      = '_hlpw_insider_optin';      // 'yes' | 'no'
const HLPW_INSIDER_DATE_META = '_hlpw_insider_optin_date'; // mysql datetime

/** Option storing the timestamp of the last CSV export. */
const HLPW_INSIDER_LAST_EXPORT = 'hlpw_insider_last_export';

/**
 * Query opted-in users, optionally only those who opted in after $since.
 *
 * @param string $since Mysql datetime, or '' for all.
 * @return WP_User[]
 */
function hlpw_get_insider_users( $since = '' ) {
	$meta_query = array(
		array(
			'key'   => HLPW_INSIDER_META,
			'value' => 'yes',
		),
	);

	if ( $since ) {
		$meta_query[] = array(
			'key'     => HLPW_INSIDER_DATE_META,
			'value'   => $since,
			'compare' => '>',
			'type'    => 'DATETIME',
		);
		$meta_query['relation'] = 'AND';
	}

	return get_users(
		array(
			'meta_query' => $meta_query,
			'orderby'    => 'user_registered',
			'order'      => 'DESC',
		)
	);
}

/* ------------------------------------------------------------------ *
 * Admin: Users -> Insider Opt-ins.
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

function hlpw_render_insider_optins_page() {
	$total       = count( hlpw_get_insider_users() );
	$last_export = get_option( HLPW_INSIDER_LAST_EXPORT, '' );
	$new_count   = $last_export ? count( hlpw_get_insider_users( $last_export ) ) : $total;

	$export_all = wp_nonce_url( admin_url( 'admin-post.php?action=hlpw_export_insider&scope=all' ), 'hlpw_export_insider' );
	$export_new = wp_nonce_url( admin_url( 'admin-post.php?action=hlpw_export_insider&scope=new' ), 'hlpw_export_insider' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'The Insider — Opt-ins', 'harnesslink-paywall' ); ?></h1>

		<p>
			<strong><?php echo (int) $total; ?></strong>
			<?php esc_html_e( 'subscriber(s) have opted in to The Insider.', 'harnesslink-paywall' ); ?>
		</p>
		<p>
			<?php
			if ( $last_export ) {
				/* translators: %s: date/time of last export */
				printf( esc_html__( 'Last export: %s.', 'harnesslink-paywall' ), esc_html( $last_export ) );
			} else {
				esc_html_e( 'No export has been run yet.', 'harnesslink-paywall' );
			}
			?>
		</p>

		<p>
			<a class="button button-primary" href="<?php echo esc_url( $export_new ); ?>">
				<?php
				/* translators: %d: number of new opt-ins */
				printf( esc_html__( 'Export new since last export (%d)', 'harnesslink-paywall' ), (int) $new_count );
				?>
			</a>
			&nbsp;
			<a class="button" href="<?php echo esc_url( $export_all ); ?>">
				<?php
				/* translators: %d: total opt-ins */
				printf( esc_html__( 'Export all (%d)', 'harnesslink-paywall' ), (int) $total );
				?>
			</a>
		</p>

		<p class="description">
			<?php esc_html_e( 'Then in Mailchimp: Audience → Import contacts → Upload file. Columns: Email Address, First Name, Last Name, Phone, Opted In Date. Either export advances the "last export" marker.', 'harnesslink-paywall' ); ?>
		</p>
	</div>
	<?php
}

/** Stream opted-in users as a Mailchimp-friendly CSV. */
add_action( 'admin_post_hlpw_export_insider', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to export.', 'harnesslink-paywall' ) );
	}
	check_admin_referer( 'hlpw_export_insider' );

	$scope = isset( $_GET['scope'] ) && 'new' === $_GET['scope'] ? 'new' : 'all';
	$since = 'new' === $scope ? get_option( HLPW_INSIDER_LAST_EXPORT, '' ) : '';

	$users = hlpw_get_insider_users( $since );

	// Advance the marker so the next "new" export starts from here.
	update_option( HLPW_INSIDER_LAST_EXPORT, current_time( 'mysql' ) );

	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename=insider-optins-' . $scope . '-' . gmdate( 'Y-m-d' ) . '.csv' );

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

/* ------------------------------------------------------------------ *
 * Users list: Insider + Mobile columns, and an "opted-in" filter.
 * ------------------------------------------------------------------ */
add_filter( 'manage_users_columns', function ( $cols ) {
	$cols['hlpw_insider'] = __( 'Insider', 'harnesslink-paywall' );
	$cols['hlpw_mobile']  = __( 'Mobile', 'harnesslink-paywall' );
	return $cols;
} );

add_filter( 'manage_users_custom_column', function ( $value, $column, $user_id ) {
	if ( 'hlpw_insider' === $column ) {
		return 'yes' === get_user_meta( $user_id, HLPW_INSIDER_META, true ) ? '✓' : '—';
	}
	if ( 'hlpw_mobile' === $column ) {
		return esc_html( get_user_meta( $user_id, '_hlpw_phone', true ) );
	}
	return $value;
}, 10, 3 );

add_action( 'restrict_manage_users', function ( $which ) {
	if ( 'top' !== $which ) {
		return;
	}
	$current = isset( $_GET['hlpw_insider_filter'] ) ? sanitize_key( wp_unslash( $_GET['hlpw_insider_filter'] ) ) : '';
	?>
	<select name="hlpw_insider_filter" style="float:none; margin:0 4px;">
		<option value=""><?php esc_html_e( 'All users', 'harnesslink-paywall' ); ?></option>
		<option value="yes" <?php selected( $current, 'yes' ); ?>><?php esc_html_e( 'Insider opted-in', 'harnesslink-paywall' ); ?></option>
	</select>
	<?php
	submit_button( __( 'Filter', 'harnesslink-paywall' ), 'secondary', 'hlpw_user_filter', false );
} );

add_action( 'pre_get_users', function ( $query ) {
	global $pagenow;
	if ( ! is_admin() || 'users.php' !== $pagenow ) {
		return;
	}
	if ( empty( $_GET['hlpw_insider_filter'] ) || 'yes' !== $_GET['hlpw_insider_filter'] ) {
		return;
	}
	$meta_query   = (array) $query->get( 'meta_query' );
	$meta_query[] = array(
		'key'   => HLPW_INSIDER_META,
		'value' => 'yes',
	);
	$query->set( 'meta_query', $meta_query );
} );
