<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Redesigned stallion/horse profile body. Included directly from
 * templates/stallion-profile.php, which has already resolved $stallion,
 * $type, $paying, $featured, $dir_url, $standing_at, $location, $cov_label,
 * $contact_blocks, $has_regional_contacts, $progeny and $supports_gait.
 */

$gallery_items  = HLD_DB::get_gallery( $stallion->id );
$gallery_images = array_values( array_filter( $gallery_items, function ( $g ) { return $g->media_type === 'image'; } ) );
$gallery_videos = array_values( array_filter( $gallery_items, function ( $g ) { return $g->media_type === 'video'; } ) );
$hero_slides    = hld_hero_slides( $stallion, $gallery_images );
$pedigree_tree  = hld_pedigree_tree( $stallion );
$crosses        = HLD_DB::get_crosses( $stallion->id );
$related        = HLD_DB::get_related_listings( HLD_DB::decode_related_ids( $stallion->related_ids ), 4 );

$booking_url   = $stallion->booking_url ?: '';
$booking_label = $stallion->booking_label ?: 'Enquire Now';

/** First line only — pedigree fields may carry a "Name\nRecord" second line not wanted here. */
$ped_name = function ( $raw ) {
    $lines = explode( "\n", (string) $raw );
    return trim( $lines[0] );
};

/* Unlabelled "By Sire × Dam · Career Earnings · Fastest Mile" line shown under the horse's name. */
$sire_name = $ped_name( $stallion->ped_sire );
$dam_name  = $ped_name( $stallion->ped_dam );
$parentage = trim( implode( ' × ', array_filter( array( $sire_name, $dam_name ) ) ) );
$vitals    = array_filter( array( $parentage, $stallion->career_earnings, $stallion->race_record ) );

$quick_facts = array_filter( array(
    'Year of Birth' => $stallion->year_of_birth,
    'Colour'        => $stallion->colour,
    'Sex'           => $stallion->sex,
    'Standing Farm' => $stallion->stud_name,
) );
?>

<!-- ═══ HERO ═══ -->
<header class="hld-horse-titlebar">
  <?php if ( $featured ): ?><div class="hld-profile-featured-badge">Featured</div><?php endif; ?>
  <h1 class="hld-horse-name"><?= esc_html( $stallion->name ) ?></h1>
  <?php if ( $vitals ): ?><p class="hld-horse-vitals"><?= esc_html( implode( '  ·  ', $vitals ) ) ?></p><?php endif; ?>
  <?php if ( $stallion->tagline ): ?><p class="hld-horse-tagline"><?= esc_html( $stallion->tagline ) ?></p><?php endif; ?>
  <div class="hld-horse-tags">
    <?php if ( $supports_gait && $stallion->type ): ?>
      <span class="hld-dir-pill hld-dir-pill--<?= strtolower( $stallion->type ) ?>"><?= esc_html( $stallion->type ) ?></span>
    <?php endif; ?>
    <?php if ( $standing_at ): ?><span class="hld-profile-tag">Standing at <?= esc_html( $standing_at ) ?></span><?php endif; ?>
    <?php if ( $stallion->service_fee ): ?><span class="hld-profile-tag hld-profile-tag--fee">Service Fee: <?= esc_html( $stallion->service_fee ) ?></span><?php endif; ?>
    <?php if ( $stallion->status_note ): ?><span class="hld-profile-tag"><?= esc_html( $stallion->status_note ) ?></span><?php endif; ?>
  </div>
  <?php if ( $booking_url ): ?>
    <a class="hld-horse-cta" href="<?= esc_url( $booking_url ) ?>" target="_blank" rel="noopener"><?= esc_html( $booking_label ) ?></a>
  <?php endif; ?>
</header>

<!-- Photo: single hero image, or a featured image + thumbnail grid when there are gallery photos too. No carousel/swipe — click any photo to view full-size. -->
<div class="hld-hero-gallery">
  <?php if ( count( $hero_slides ) > 1 ): ?>
    <div class="hld-gallery-layout">
      <div class="hld-gallery-featured">
        <a href="<?= esc_url( $hero_slides[0]['full'] ) ?>" class="hld-lightbox-trigger" data-caption="<?= esc_attr( $hero_slides[0]['alt'] ) ?>" data-type="image">
          <img class="hld-gallery-featured__img" src="<?= esc_url( $hero_slides[0]['full'] ) ?>" alt="<?= esc_attr( $hero_slides[0]['alt'] ) ?>" />
          <span class="hld-gallery-zoom" aria-hidden="true">⤢</span>
        </a>
      </div>
      <div class="hld-gallery-grid-pub">
        <?php foreach ( array_slice( $hero_slides, 1 ) as $slide ): ?>
          <a href="<?= esc_url( $slide['full'] ) ?>" class="hld-gallery-thumb hld-lightbox-trigger" data-caption="<?= esc_attr( $slide['alt'] ) ?>" data-type="image">
            <img src="<?= esc_url( $slide['thumb'] ) ?>" alt="<?= esc_attr( $slide['alt'] ) ?>" loading="lazy" />
            <span class="hld-gallery-zoom-sm" aria-hidden="true">⤢</span>
          </a>
        <?php endforeach; ?>
      </div>
    </div>

    <div id="hld-lightbox" class="hld-lightbox" style="display:none;" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div class="hld-lightbox__backdrop"></div>
      <div class="hld-lightbox__content">
        <img class="hld-lightbox__img" src="" alt="" />
        <video class="hld-lightbox__video" style="display:none;" controls></video>
        <div class="hld-lightbox__caption"></div>
      </div>
      <button type="button" class="hld-lightbox__close" aria-label="Close photo viewer">✕</button>
      <button type="button" class="hld-lightbox__prev" aria-label="Previous photo">‹</button>
      <button type="button" class="hld-lightbox__next" aria-label="Next photo">›</button>
    </div>
  <?php elseif ( count( $hero_slides ) === 1 ): ?>
    <div class="hld-horse-photo">
      <img src="<?= esc_url( $hero_slides[0]['full'] ) ?>" alt="<?= esc_attr( $hero_slides[0]['alt'] ) ?>" />
    </div>
  <?php else: ?>
    <div class="hld-horse-photo hld-horse-photo--empty">
      <div class="hld-profile-placeholder-text"><?= esc_html( strtoupper( substr( $stallion->name, 0, 2 ) ) ) ?></div>
    </div>
  <?php endif; ?>
</div>

<!-- Pedigree: full page width so the three-generation tree has room to breathe — no horizontal scroll. -->
<div class="hld-hero-pedigree">
  <h2 class="hld-ped-heading">Pedigree</h2>
  <?php if ( $pedigree_tree && ! empty( $pedigree_tree['children'] ) ): ?>
    <div class="hld-ped-tree">
      <?php hld_render_pedigree_node( $pedigree_tree, true ); ?>
    </div>
  <?php else: ?>
    <p class="hld-ped-empty">Pedigree details coming soon.</p>
  <?php endif; ?>
</div>

<div class="hld-profile-body">

<!-- ═══ NAME / SUMMARY BLOCK ═══ -->
<?php if ( $stallion->short_summary || $quick_facts ): ?>
  <div class="hld-profile-section hld-horse-summary">
    <?php if ( $stallion->short_summary ): ?>
      <p class="hld-horse-summary__text"><?= esc_html( $stallion->short_summary ) ?></p>
    <?php endif; ?>
    <?php if ( $quick_facts ): ?>
      <div class="hld-profile-meta-grid">
        <?php foreach ( $quick_facts as $label => $value ): ?>
          <div class="hld-profile-meta-item">
            <span class="hld-profile-meta-label"><?= esc_html( $label ) ?></span>
            <span class="hld-profile-meta-val"><?= esc_html( $value ) ?></span>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
<?php endif; ?>

<!-- ═══ ABOUT + CROSSES OF GOLD ═══ -->
<?php if ( ( $paying && $stallion->profile_bio ) || $stallion->crosses_intro || ! empty( $crosses ) ): ?>
  <div class="hld-profile-section hld-about-crosses">
    <?php if ( $paying && $stallion->profile_bio ): ?>
      <div class="hld-about-crosses__col">
        <h2>About the Horse</h2>
        <div class="hld-profile-bio"><?= wp_kses_post( $stallion->profile_bio ) ?></div>
      </div>
    <?php endif; ?>
    <?php if ( $stallion->crosses_intro || ! empty( $crosses ) ): ?>
      <div class="hld-about-crosses__col">
        <h2>Crosses of Gold</h2>
        <?php if ( $stallion->crosses_intro ): ?>
          <div class="hld-profile-bio"><?= wp_kses_post( $stallion->crosses_intro ) ?></div>
        <?php endif; ?>
        <?php if ( ! empty( $crosses ) ): ?>
          <div class="hld-cross-list">
            <?php foreach ( $crosses as $cross ): ?>
              <?php if ( ! $cross->title ) continue; ?>
              <div class="hld-cross">
                <h3 class="hld-cross__title"><?= esc_html( $cross->title ) ?></h3>
                <?php if ( $cross->description ): ?><div class="hld-cross__desc"><?= wp_kses_post( $cross->description ) ?></div><?php endif; ?>
                <?php if ( $cross->examples ): ?><p class="hld-cross__examples"><strong>Notable examples:</strong> <?= esc_html( $cross->examples ) ?></p><?php endif; ?>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
<?php endif; ?>

<!-- ═══ OPTIONAL MEDIA (VIDEOS) ═══ -->
<?php if ( ! empty( $gallery_videos ) ): ?>
  <div class="hld-profile-section hld-horse-media">
    <h2>Videos</h2>
    <div class="hld-video-grid">
      <?php foreach ( $gallery_videos as $video ): ?>
        <div class="hld-video-card">
          <div class="hld-video-card__embed"><?= hld_video_embed_html( $video ) ?></div>
          <?php if ( $video->caption ): ?><h3 class="hld-video-card__title"><?= esc_html( $video->caption ) ?></h3><?php endif; ?>
          <?php if ( $video->description ): ?><p class="hld-video-card__desc"><?= esc_html( $video->description ) ?></p><?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<!-- ═══ RELATED HORSES ═══ -->
<?php if ( ! empty( $related ) ): ?>
  <div class="hld-profile-section hld-related-horses">
    <h2>Related Stallions</h2>
    <div class="hld-related-grid">
      <?php foreach ( $related as $r ): ?>
        <?php
          $r_slides = hld_hero_slides( $r, array() );
          $r_img    = $r_slides ? $r_slides[0]['full'] : '';
          $r_url    = hld_listing_url( $r );
          $r_desc   = $r->tagline ?: $r->stud_name;
        ?>
        <a class="hld-related-card" href="<?= esc_url( $r_url ) ?>">
          <div class="hld-related-card__img-wrap">
            <?php if ( $r_img ): ?>
              <img src="<?= esc_url( $r_img ) ?>" alt="<?= esc_attr( $r->name ) ?>" loading="lazy" />
            <?php else: ?>
              <div class="hld-profile-placeholder-text"><?= esc_html( strtoupper( substr( $r->name, 0, 2 ) ) ) ?></div>
            <?php endif; ?>
          </div>
          <div class="hld-related-card__body">
            <strong><?= esc_html( $r->name ) ?></strong>
            <?php if ( $r_desc ): ?><span><?= esc_html( $r_desc ) ?></span><?php endif; ?>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>

<!-- ═══ NOTABLE PROGENY (existing) ═══ -->
<?php if ( ! empty( $progeny ) ): ?>
  <div class="hld-profile-section hld-progeny-section">
    <div class="hld-progeny-head">
      <h2>Notable Progeny</h2>
      <span class="hld-progeny-count"><?= count( $progeny ) ?> listed</span>
    </div>
    <?php $progeny_intro = HLD_DB::progeny_intro( $stallion->name ); ?>
    <?php if ( $progeny_intro ): ?>
      <p class="hld-progeny-intro"><?= esc_html( $progeny_intro ) ?></p>
    <?php endif; ?>
    <div class="hld-progeny-scroll">
      <table class="hld-progeny-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Foaled</th>
            <th>Country</th>
            <th>Sex</th>
            <th>Dam</th>
            <th>Broodmare Sire</th>
            <th class="hld-num">Prizemoney</th>
            <th>Best Mile</th>
            <th class="hld-num">Starts</th>
            <th class="hld-num">Wins</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ( $progeny as $p ): ?>
            <tr>
              <td class="hld-progeny-name"><?= esc_html( $p->name ) ?></td>
              <td><?= esc_html( $p->foaling_date ) ?></td>
              <td><?php if ( $p->country ): ?><span class="hld-progeny-flag"><?= esc_html( $p->country ) ?></span><?php endif; ?></td>
              <td><?= esc_html( $p->sex ) ?></td>
              <td><?= esc_html( $p->dam ) ?></td>
              <td><?= esc_html( $p->broodmare_sire ) ?></td>
              <td class="hld-num hld-progeny-money"><?= esc_html( $p->prizemoney ) ?></td>
              <td><?= esc_html( $p->mile_rate ) ?></td>
              <td class="hld-num"><?= (int) $p->starts ?></td>
              <td class="hld-num"><?= (int) $p->wins ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <p class="hld-progeny-note">Progeny registered in Australia. International (NZ/US) progeny may not be fully represented.</p>
  </div>
<?php elseif ( $paying && $stallion->progeny_note ): ?>
  <div class="hld-profile-section">
    <h2>Notable Progeny</h2>
    <div class="hld-profile-bio"><?= nl2br( esc_html( $stallion->progeny_note ) ) ?></div>
  </div>
<?php endif; ?>

<!-- ═══ CONTACT DETAILS (existing) ═══ -->
<?php if ( $paying ): ?>
  <div class="hld-profile-section hld-profile-contact-card" id="hld-profile-contact">
    <h2>Contact Details</h2>
    <div class="hld-profile-contact-grid">
      <?php if ( $stallion->contact_website ): ?>
        <div class="hld-contact-item">
          <span class="hld-contact-label">Stallion Page</span>
          <a href="<?= esc_url( $stallion->contact_website ) ?>" target="_blank" rel="noopener"><?= esc_html( $stallion->contact_website ) ?></a>
        </div>
      <?php endif; ?>
      <?php if ( ! empty( $stallion->stud_website ) ): ?>
        <div class="hld-contact-item">
          <span class="hld-contact-label">Stud Website</span>
          <a href="<?= esc_url( $stallion->stud_website ) ?>" target="_blank" rel="noopener"><?= esc_html( $stallion->stud_website ) ?></a>
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
          <span><?= esc_html( $stallion->stud_name ) ?></span>
        </div>
      <?php endif; ?>
      <?php if ( ! $has_regional_contacts && $stallion->contact_phone ): ?>
        <div class="hld-contact-item">
          <span class="hld-contact-label">Phone</span>
          <a href="tel:<?= esc_attr( $stallion->contact_phone ) ?>"><?= esc_html( $stallion->contact_phone ) ?></a>
        </div>
      <?php endif; ?>
      <?php if ( ! $has_regional_contacts && $stallion->contact_email ): ?>
        <div class="hld-contact-item">
          <span class="hld-contact-label">Email</span>
          <a href="mailto:<?= esc_attr( $stallion->contact_email ) ?>"><?= esc_html( $stallion->contact_email ) ?></a>
        </div>
      <?php endif; ?>
      <?php if ( ! $has_regional_contacts && $stallion->contact_address ): ?>
        <div class="hld-contact-item">
          <span class="hld-contact-label">Address</span>
          <span><?= nl2br( esc_html( $stallion->contact_address ) ) ?></span>
        </div>
      <?php endif; ?>
    </div>
  </div>
<?php else: ?>
  <div class="hld-profile-section hld-profile-locked" id="hld-profile-contact">
    <h2>Contact Details</h2>
    <p>This is a paid partner feature. <a href="mailto:info@harnesslink.com">Contact HarnessLink</a> to upgrade the listing.</p>
  </div>
<?php endif; ?>

</div><!-- /.hld-profile-body -->
