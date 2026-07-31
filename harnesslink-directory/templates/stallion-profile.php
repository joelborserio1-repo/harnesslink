<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* $stallion should be in scope via template_redirect or shortcode */
if ( ! isset( $stallion ) ) {
    $stallion = HLD_DB::get_stallion( get_query_var( 'hld_stallion_id' ) );
}
if ( ! $stallion ) { wp_redirect( home_url('/directory/') ); exit; }
if ( ! is_user_logged_in() ) {
    $current_url = home_url( wp_unslash( $_SERVER['REQUEST_URI'] ?? '/directory/' ) );
    wp_safe_redirect( hld_login_url( $current_url ) );
    exit;
}

$standalone = ! did_action( 'wp_head' );
if ( $standalone ) get_header();

$type          = HLD_Types::get( $stallion->directory_type ?? 'stallion' );
if ( ! $type ) $type = HLD_Types::get( HLD_Types::default_slug() );
$supports_gait = ! empty( $type['supports_gait'] );
$layout        = HLD_Types::layout( $type['slug'] );

$paying      = (bool) $stallion->is_paying;
$featured    = ! empty( $stallion->is_featured );
$dir_url     = hld_directory_url( $type['slug'] );
$standing_at = trim( implode( ' / ', array_filter( array( $stallion->country, $stallion->region ) ) ) );
$location    = implode( ' · ', array_filter( array( $stallion->suburb ?? '', $stallion->region ?? '', $stallion->country ?? '' ) ) );
$cov_label   = 'Coverage';
foreach ( HLD_Types::fields( $type['slug'] ) as $f ) {
    if ( $f['key'] === 'coverage' ) { $cov_label = $f['label']; break; }
}
$country_label = strtoupper( (string) $stallion->country );
$contact_blocks = array();

if ( stripos( $stallion->country, 'australia' ) !== false || preg_match( '/\bAU\b/', $country_label ) ) {
    if ( ! empty( $stallion->contact_au ) ) $contact_blocks['AU Contact'] = $stallion->contact_au;
}
if ( stripos( $stallion->country, 'new zealand' ) !== false || preg_match( '/\bNZ\b/', $country_label ) ) {
    if ( ! empty( $stallion->contact_nz ) ) $contact_blocks['NZ Contact'] = $stallion->contact_nz;
}
if ( stripos( $stallion->country, 'united states' ) !== false || preg_match( '/\bUS\b|\bUSA\b/', $country_label ) ) {
    if ( ! empty( $stallion->contact_us ) ) $contact_blocks['US Contact'] = $stallion->contact_us;
}
if ( stripos( $stallion->country, 'france' ) !== false || preg_match( '/\bFR\b|\bFRA\b/', $country_label ) ) {
    if ( ! empty( $stallion->contact_fr ) ) $contact_blocks['France Contact'] = $stallion->contact_fr;
}
if ( empty( $contact_blocks ) && ! empty( $stallion->contact_other ) ) {
    $contact_blocks['Contact'] = $stallion->contact_other;
}
$has_regional_contacts = ! empty( $contact_blocks );

/* Structured progeny (stallions only, paid listings). */
$progeny = ( $paying && $supports_gait ) ? HLD_DB::get_progeny( $stallion->id ) : array();
?>

<div class="hl-directory harnesslink-directory hld-profile-wrap">

  <!-- Breadcrumb -->
  <nav class="hld-breadcrumb">
    <a href="<?= esc_url( home_url( '/directory/' ) ) ?>">Directory</a>
    <span>›</span>
    <a href="<?= esc_url( $dir_url ) ?>"><?= wp_kses( $type['plural'], array() ) ?></a>
    <span>›</span>
    <span><?= esc_html( $stallion->name ) ?></span>
  </nav>

  <?php if ( $layout === 'stallion' ): ?>
    <?php include HLD_PLUGIN_DIR . 'templates/partials/horse-profile.php'; ?>
  <?php else: ?>
    <?php include HLD_PLUGIN_DIR . 'templates/partials/service-profile.php'; ?>
  <?php endif; ?>

  <div class="hld-profile-back">
    <a href="<?= esc_url( $dir_url ) ?>" class="hld-dir-link">← Back to <?= wp_kses( $type['plural'], array() ) ?> Directory</a>
  </div>

</div>

<?php if ( $standalone ) get_footer(); ?>
