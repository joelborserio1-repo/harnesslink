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

  <!-- Profile hero -->
  <div class="hld-profile-hero">
    <?php if ( $stallion->profile_image ): ?>
      <div class="hld-profile-img-wrap">
        <img src="<?= esc_url( $stallion->profile_image ) ?>" alt="<?= esc_attr( $stallion->name ) ?>" class="hld-profile-img" onerror="this.parentNode.classList.add('hld-profile-img-wrap--placeholder');this.parentNode.innerHTML='<div class=&quot;hld-profile-placeholder-text&quot;><?= esc_attr( strtoupper( substr( $stallion->name, 0, 2 ) ) ) ?></div>';" />
      </div>
    <?php else: ?>
      <div class="hld-profile-img-wrap hld-profile-img-wrap--placeholder">
        <div class="hld-profile-placeholder-text"><?= esc_html( strtoupper( substr( $stallion->name, 0, 2 ) ) ) ?></div>
      </div>
    <?php endif; ?>

    <div class="hld-profile-hero__info">
      <div class="hld-profile-eyebrow"><?= wp_kses( $type['singular'], array() ) ?> Profile</div>
      <?php if ( $featured ): ?>
        <div class="hld-profile-featured-badge">Featured</div>
      <?php endif; ?>
      <h1 class="hld-profile-name"><?= esc_html( $stallion->name ) ?></h1>

      <div class="hld-profile-tags">
        <?php if ( $supports_gait && $stallion->type ): ?>
          <span class="hld-dir-pill hld-dir-pill--<?= strtolower($stallion->type) ?>"><?= esc_html( $stallion->type ) ?></span>
        <?php endif; ?>
        <?php if ( $layout === 'stallion' && $standing_at ): ?>
          <span class="hld-profile-tag">Standing at <?= esc_html( $standing_at ) ?></span>
        <?php elseif ( $layout !== 'stallion' && $location ): ?>
          <span class="hld-profile-tag"><?= esc_html( $location ) ?></span>
        <?php endif; ?>
        <?php if ( ! empty( $stallion->industry ) ): ?>
          <span class="hld-profile-tag"><?= esc_html( $stallion->industry ) ?></span>
        <?php endif; ?>
        <?php if ( $stallion->status_note ): ?>
          <span class="hld-profile-tag"><?= esc_html( $stallion->status_note ) ?></span>
        <?php endif; ?>
      </div>

      <div class="hld-profile-meta-grid">
        <?php if ( $layout === 'stallion' ): ?>
          <?php if ( $stallion->stud_name ): ?>
            <div class="hld-profile-meta-item">
              <span class="hld-profile-meta-label"><?= wp_kses( $type['org_label'], array() ) ?></span>
              <span class="hld-profile-meta-val"><?= esc_html( $stallion->stud_name ) ?></span>
            </div>
          <?php endif; ?>
          <?php if ( $stallion->stud_master ): ?>
            <div class="hld-profile-meta-item">
              <span class="hld-profile-meta-label">Stud Master</span>
              <span class="hld-profile-meta-val"><?= esc_html( $stallion->stud_master ) ?></span>
            </div>
          <?php endif; ?>
          <?php if ( $supports_gait && $stallion->race_record ): ?>
            <div class="hld-profile-meta-item">
              <span class="hld-profile-meta-label">Race Record</span>
              <span class="hld-profile-meta-val"><?= esc_html( $stallion->race_record ) ?></span>
            </div>
          <?php endif; ?>
        <?php else: ?>
          <?php if ( $location ): ?>
            <div class="hld-profile-meta-item">
              <span class="hld-profile-meta-label">Location</span>
              <span class="hld-profile-meta-val"><?= esc_html( $location ) ?></span>
            </div>
          <?php endif; ?>
          <?php if ( ! empty( $stallion->industry ) ): ?>
            <div class="hld-profile-meta-item">
              <span class="hld-profile-meta-label">Industry Involvement</span>
              <span class="hld-profile-meta-val"><?= esc_html( $stallion->industry ) ?></span>
            </div>
          <?php endif; ?>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <!-- Profile body -->
  <div class="hld-profile-body">

    <!-- Bio -->
    <?php if ( $paying && $stallion->profile_bio ): ?>
      <div class="hld-profile-section">
        <h2>About</h2>
        <div class="hld-profile-bio"><?= wp_kses_post( $stallion->profile_bio ) ?></div>
      </div>
    <?php endif; ?>

    <!-- Progeny -->
    <?php if ( $paying && $supports_gait && $stallion->progeny_note ): ?>
      <div class="hld-profile-section">
        <h2>Notable Progeny</h2>
        <div class="hld-profile-bio"><?= nl2br( esc_html( $stallion->progeny_note ) ) ?></div>
      </div>
    <?php endif; ?>

    <!-- Contact card -->
    <?php if ( $paying ): ?>
      <div class="hld-profile-section hld-profile-contact-card" id="hld-profile-contact">
        <h2>Contact Details</h2>
        <div class="hld-profile-contact-grid">
        <?php if ( $layout !== 'stallion' ): /* ── Service / business contact card ── */ ?>
          <?php if ( $stallion->contact_phone ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Phone</span>
              <a href="tel:<?= esc_attr($stallion->contact_phone) ?>"><?= esc_html($stallion->contact_phone) ?></a>
            </div>
          <?php endif; ?>
          <?php if ( $stallion->contact_email ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Email</span>
              <a href="mailto:<?= esc_attr($stallion->contact_email) ?>"><?= esc_html($stallion->contact_email) ?></a>
            </div>
          <?php endif; ?>
          <?php if ( $stallion->contact_website ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Website</span>
              <a href="<?= esc_url($stallion->contact_website) ?>" target="_blank" rel="noopener"><?= esc_html($stallion->contact_website) ?></a>
            </div>
          <?php endif; ?>
          <?php if ( $location ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Location</span>
              <span><?= esc_html( $location ) ?></span>
            </div>
          <?php endif; ?>
          <?php if ( ! empty( $stallion->coverage ) ): ?>
            <div class="hld-contact-item hld-contact-item--block">
              <span class="hld-contact-label"><?= esc_html( $cov_label ) ?></span>
              <span><?= nl2br( esc_html( $stallion->coverage ) ) ?></span>
            </div>
          <?php endif; ?>
        <?php else: /* ── Stallion contact card (unchanged) ── */ ?>
          <?php if ( $stallion->contact_website ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Stallion Page</span>
              <a href="<?= esc_url($stallion->contact_website) ?>" target="_blank" rel="noopener"><?= esc_html($stallion->contact_website) ?></a>
            </div>
          <?php endif; ?>
          <?php if ( ! empty( $stallion->stud_website ) ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Stud Website</span>
              <a href="<?= esc_url($stallion->stud_website) ?>" target="_blank" rel="noopener"><?= esc_html($stallion->stud_website) ?></a>
            </div>
          <?php endif; ?>
          <?php foreach ( $contact_blocks as $label => $details ): ?>
            <div class="hld-contact-item hld-contact-item--block">
              <span class="hld-contact-label"><?= esc_html( $label ) ?></span>
              <span><?= nl2br( esc_html( $details ) ) ?></span>
            </div>
          <?php endforeach; ?>
          <?php if ( ! $has_regional_contacts && $stallion->stud_name ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label"><?= wp_kses( $type['org_label'], array() ) ?></span>
              <span><?= esc_html($stallion->stud_name) ?></span>
            </div>
          <?php endif; ?>
          <?php if ( ! $has_regional_contacts && $stallion->contact_phone ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Phone</span>
              <a href="tel:<?= esc_attr($stallion->contact_phone) ?>"><?= esc_html($stallion->contact_phone) ?></a>
            </div>
          <?php endif; ?>
          <?php if ( ! $has_regional_contacts && $stallion->contact_email ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Email</span>
              <a href="mailto:<?= esc_attr($stallion->contact_email) ?>"><?= esc_html($stallion->contact_email) ?></a>
            </div>
          <?php endif; ?>
          <?php if ( ! $has_regional_contacts && $stallion->contact_address ): ?>
            <div class="hld-contact-item">
              <span class="hld-contact-label">Address</span>
              <span><?= nl2br( esc_html($stallion->contact_address) ) ?></span>
            </div>
          <?php endif; ?>
        <?php endif; /* end layout branch */ ?>
        </div>
      </div>
    <?php else: ?>
      <div class="hld-profile-section hld-profile-locked" id="hld-profile-contact">
        <h2>Contact Details</h2>
        <p>This is a paid partner feature. <a href="mailto:info@harnesslink.com">Contact HarnessLink</a> to upgrade the listing.</p>
      </div>
    <?php endif; ?>

  </div>

  <div class="hld-profile-back">
    <a href="<?= esc_url( $dir_url ) ?>" class="hld-dir-link">← Back to <?= wp_kses( $type['plural'], array() ) ?> Directory</a>
  </div>

</div>

<?php if ( $standalone ) get_footer(); ?>
