<?php
/**
 * Generic directory listing row — shared by the directory template and the
 * AJAX search handler. Renders one of two layouts:
 *   - 'stallion' : Name | Stud | Country | Gait | Profile | Contact
 *   - 'service'  : Name | Location | Profile | Contact
 *
 * Expected in scope:
 *   $listing   — the row object (falls back to legacy $stallion / $s)
 *   $hld_type  — the resolved directory type record (from HLD_Types::get())
 */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! isset( $listing ) ) {
    $listing = isset( $stallion ) ? $stallion : ( isset( $s ) ? $s : null );
}
if ( ! $listing ) return;

if ( empty( $hld_type ) ) {
    $hld_type = HLD_Types::get( $listing->directory_type ?? 'stallion' );
}
$layout        = HLD_Types::layout( $hld_type['slug'] ?? 'stallion' );
$supports_gait = ! empty( $hld_type['supports_gait'] );
$cols          = $layout === 'stallion' ? ( $supports_gait ? 6 : 5 ) : 4;

$paying      = (bool) $listing->is_paying;
$featured    = ! empty( $listing->is_featured );
$profile_url = hld_listing_url( $listing );
$contact_url = $profile_url . '#hld-profile-contact';
$logged_in   = is_user_logged_in();
$login_url   = hld_login_url( $profile_url );

/* Location string: Suburb · State · Country (non-empty parts only) */
$location = implode( ' · ', array_filter( array(
    $listing->suburb ?? '',
    $listing->region ?? '',
    $listing->country ?? '',
) ) );
?>
<tr class="hld-dir-row <?= $paying ? 'hld-dir-row--paying' : 'hld-dir-row--free' ?> <?= $featured ? 'hld-dir-row--featured' : '' ?>">
  <td data-label="<?= esc_attr( $hld_type['name_label'] ?? 'Name' ) ?>">
    <?php if ( $paying && $logged_in ): ?>
      <a href="<?= esc_url( $profile_url ) ?>" class="hld-dir-sname"><?= esc_html( $listing->name ) ?></a>
    <?php else: ?>
      <span class="hld-dir-sname hld-dir-sname--locked"><?= esc_html( $listing->name ) ?></span>
    <?php endif; ?>
    <?php if ( $listing->status_note ): ?>
      <div class="hld-dir-smeta"><?= esc_html( $listing->status_note ) ?></div>
    <?php endif; ?>
    <?php if ( $featured ): ?>
      <div class="hld-featured-stud-badge">Featured</div>
    <?php endif; ?>
  </td>

  <?php if ( $layout === 'stallion' ): ?>

    <td data-label="<?= esc_attr( $hld_type['org_label'] ?? 'Organisation' ) ?>">
      <?php if ( $paying ): ?>
        <?= esc_html( $listing->stud_name ) ?>
      <?php else: ?>
        <span class="hld-dir-muted">Paid Feature</span>
      <?php endif; ?>
    </td>

    <td data-label="Country"><?= esc_html( $listing->country ) ?></td>

    <?php if ( $supports_gait ): ?>
    <td data-label="Gait">
      <?php if ( $listing->type ): ?>
        <span class="hld-dir-pill hld-dir-pill--<?= strtolower( esc_attr( $listing->type ) ) ?>">
          <?= esc_html( $listing->type ) ?>
        </span>
      <?php endif; ?>
    </td>
    <?php endif; ?>

  <?php else: ?>

    <td data-label="Location">
      <?php if ( $location ): ?>
        <span class="hld-dir-location"><?= esc_html( $location ) ?></span>
      <?php else: ?>
        <span class="hld-dir-muted">—</span>
      <?php endif; ?>
    </td>

  <?php endif; ?>

  <td data-label="Profile">
    <?php if ( ! $logged_in ): ?>
      <a href="<?= esc_url( $login_url ) ?>" class="hld-dir-link hld-dir-link--login">Login to View</a>
    <?php elseif ( $paying ): ?>
      <a href="<?= esc_url( $profile_url ) ?>" class="hld-dir-link">View Profile</a>
    <?php else: ?>
      <a href="#hld-claim-<?= esc_attr( $listing->id ) ?>" class="hld-dir-link--partner hld-claim-toggle" data-id="<?= esc_attr( $listing->id ) ?>">
        <s>View Profile</s>
        <span class="hld-partner-lock">Paid Feature</span>
      </a>
    <?php endif; ?>
  </td>

  <td data-label="Contact">
    <?php if ( ! $logged_in ): ?>
      <a href="<?= esc_url( hld_login_url( $contact_url ) ) ?>" class="hld-dir-link hld-dir-link--login">Login to View</a>
    <?php elseif ( $paying ): ?>
      <a href="<?= esc_url( $contact_url ) ?>" class="hld-dir-link">Contact</a>
    <?php else: ?>
      <a href="#hld-claim-<?= esc_attr( $listing->id ) ?>" class="hld-dir-link--partner hld-claim-toggle" data-id="<?= esc_attr( $listing->id ) ?>">
        <s>Contact</s>
        <span class="hld-partner-lock">Paid Feature</span>
      </a>
    <?php endif; ?>
  </td>
</tr>

<?php if ( ! $paying && $logged_in ): ?>
<tr class="hld-claim-row" id="hld-claim-<?= esc_attr( $listing->id ) ?>" style="display:none;">
  <td colspan="<?= (int) $cols ?>">
    <div class="hld-claim-panel" data-stallion="<?= esc_attr( $listing->name ) ?>" data-listing-type="<?= esc_attr( $hld_type['singular'] ?? 'Stallion' ) ?>" data-country="<?= esc_attr( $listing->country ) ?>" data-region="<?= esc_attr( $listing->region ) ?>">
      <div class="hld-claim-copy">
        <div class="hld-claim-kicker">Is this yours?</div>
        <strong>Join HarnessLink and have your listing featured on the global HarnessLink platform.</strong>
        <p>Send your details to our team and we will review the listing in the backend.</p>
      </div>
      <div class="hld-claim-form">
        <input type="text" class="hld-claim-name" placeholder="Your name" />
        <input type="email" class="hld-claim-email" placeholder="Email address" />
        <input type="tel" class="hld-claim-phone" placeholder="Phone optional" />
        <input type="text" class="hld-claim-stud" placeholder="Business / organisation" />
        <textarea class="hld-claim-message" rows="2" placeholder="Anything our team should know?"></textarea>
        <button type="button" class="hld-claim-submit">Send for Review</button>
        <button type="button" class="hld-claim-cancel">Cancel</button>
        <div class="hld-claim-error" style="display:none;"></div>
        <div class="hld-claim-success" style="display:none;">Thanks, your request has been sent to the HarnessLink team.</div>
      </div>
    </div>
  </td>
</tr>
<?php endif; ?>
