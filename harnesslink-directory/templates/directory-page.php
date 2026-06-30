<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* If called via template_redirect, boot WP header/footer */
$standalone = ! did_action( 'wp_head' );
if ( $standalone ) get_header();

/* ── Resolve the active directory type ──
   Precedence: ?hld_type GET → archive route var → shortcode attr → default */
$requested =
    ! empty( $_GET['hld_type'] )            ? $_GET['hld_type'] :
    ( ! empty( $hld_active_type )           ? $hld_active_type :
    ( ! empty( $hld_shortcode_type )        ? $hld_shortcode_type : '' ) );

$active_slug = HLD_Types::resolve( $requested );
$type        = HLD_Types::get( $active_slug );
$show_nav    = isset( $hld_show_nav ) ? (bool) $hld_show_nav : true;

$nav_counts      = HLD_DB::counts_by_type();
$hld_active_type = $active_slug;
$hld_nav_counts  = $nav_counts;

$total_for_type = isset( $nav_counts[ $active_slug ] ) ? (int) $nav_counts[ $active_slug ] : 0;
$supports_gait  = ! empty( $type['supports_gait'] );
$layout         = HLD_Types::layout( $active_slug );

$countries      = HLD_DB::get_country_filter_options();
$per_page_opts  = HLD_DB::per_page_options();
$default_pp     = $per_page_opts[0];
$initial        = HLD_DB::get_listings( array( 'directory_type' => $active_slug, 'per_page' => $default_pp ) );
$active_letters = HLD_DB::get_active_letters( $active_slug );
$col_count      = $layout === 'stallion' ? ( $supports_gait ? 6 : 5 ) : 4;
?>

<div class="hl-directory harnesslink-directory hld-dir-wrap" data-directory-type="<?= esc_attr( $active_slug ) ?>">

  <!-- ── Page header bar ── -->
  <div class="hld-dir-header-bar">
    <div class="hld-dir-header-bar__left">
      <h1 class="hld-dir-page-title"><?= wp_kses( $type['plural'], array() ) ?> Directory</h1>
      <?php if ( ! empty( $type['tagline'] ) ): ?>
        <span class="hld-dir-page-sub"><?= wp_kses( $type['tagline'], array() ) ?></span>
      <?php endif; ?>
    </div>
    <button class="hld-dir-list-btn hld-open-enquiry-btn" data-listing-type="<?= esc_attr( wp_strip_all_tags( $type['singular'] ) ) ?>">
      + List Your <?= wp_kses( $type['singular'], array() ) ?>
    </button>
  </div>

  <!-- ── Category navigation ── -->
  <?php if ( $show_nav ) include HLD_PLUGIN_DIR . 'templates/partials/category-nav.php'; ?>

  <?php if ( $total_for_type === 0 ): ?>

    <!-- ── Branded "coming soon" empty state ── -->
    <div class="hld-coming-soon">
      <div class="hld-coming-soon__badge">
        <?php $cs_icon = HLD_Types::icon_svg( $active_slug ); echo $cs_icon ? $cs_icon : esc_html( $type['icon'] ); ?>
      </div>
      <h2>This HarnessLink Directory category is coming soon.</h2>
      <p><?= wp_kses( $type['description'], array() ) ?></p>
      <p class="hld-coming-soon__cta-text">Interested in listing your business? Be one of the first featured in the <strong><?= wp_kses( $type['plural'], array() ) ?></strong> directory.</p>
      <button class="hld-dir-search-btn hld-open-enquiry-btn" data-listing-type="<?= esc_attr( wp_strip_all_tags( $type['singular'] ) ) ?>">Contact HarnessLink</button>
    </div>

  <?php else: ?>

  <!-- ── Filters row ── -->
  <div class="hld-dir-filters">
    <div class="hld-dir-search-wrap">
      <span class="hld-dir-search-icon">⌕</span>
      <input class="hld-dir-search" type="text" id="hld-search" placeholder="Search <?= esc_attr( strtolower( wp_strip_all_tags( $type['singular'] ) ) ) ?>, name or location..." />
    </div>

    <div class="hld-dir-selects">
      <select class="hld-dir-select" id="hld-filter-country">
        <option value="">All Countries</option>
        <?php foreach ( $countries as $value => $label ): ?>
          <option value="<?= esc_attr($value) ?>"><?= esc_html($label) ?></option>
        <?php endforeach; ?>
      </select>

      <?php if ( $supports_gait ): ?>
      <select class="hld-dir-select" id="hld-filter-type">
        <option value="">All Gaits</option>
        <option value="Pacer">Pacer</option>
        <option value="Trotter">Trotter</option>
      </select>
      <?php endif; ?>
    </div>
    <div class="hld-dir-search-action">
      <button class="hld-dir-search-btn" id="hld-search-btn">Search</button>
    </div>
  </div>

  <!-- ── Alphabet index ── -->
  <nav class="hld-az-index" id="hld-az-index" aria-label="Filter by first letter">
    <button type="button" class="hld-az-letter hld-az-letter--active" data-letter="">All</button>
    <?php
    foreach ( range( 'A', 'Z' ) as $L ):
      $has = ! empty( $active_letters[ $L ] );
    ?>
      <button type="button"
              class="hld-az-letter<?= $has ? '' : ' hld-az-letter--empty' ?>"
              data-letter="<?= esc_attr( $L ) ?>"
              <?= $has ? '' : 'disabled aria-disabled="true"' ?>><?= esc_html( $L ) ?></button>
    <?php endforeach; ?>
    <?php if ( ! empty( $active_letters['#'] ) ): ?>
      <button type="button" class="hld-az-letter" data-letter="#" title="Names starting with a number or symbol">#</button>
    <?php endif; ?>
  </nav>

  <!-- ── Table ── -->
  <div class="hld-dir-table-card">
    <div class="hld-dir-table-header">
      <span class="hld-dir-count" id="hld-count">Showing <?= (int) $initial['total'] ?> <?= esc_html( strtolower( wp_strip_all_tags( $initial['total'] === 1 ? $type['singular'] : $type['plural'] ) ) ) ?></span>
      <label class="hld-dir-perpage">
        <span>View</span>
        <select id="hld-per-page" class="hld-dir-select hld-dir-select--sm">
          <?php foreach ( $per_page_opts as $opt ): ?>
            <option value="<?= (int) $opt ?>"><?= (int) $opt ?></option>
          <?php endforeach; ?>
        </select>
        <span>per page</span>
      </label>
    </div>
    <div class="hld-dir-table-wrap">
      <table class="hld-dir-table">
        <thead>
          <tr>
            <th><?= wp_kses( $type['name_label'], array() ) ?></th>
            <?php if ( $layout === 'stallion' ): ?>
              <th><?= wp_kses( $type['org_label'], array() ) ?></th>
              <th>Country</th>
              <?php if ( $supports_gait ): ?><th>Gait</th><?php endif; ?>
            <?php else: ?>
              <th>Location</th>
            <?php endif; ?>
            <th>Profile</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody id="hld-table-body">
          <?php
          $hld_type = $type;
          foreach ( $initial['items'] as $listing ):
            include HLD_PLUGIN_DIR . 'templates/partials/listing-row.php';
          endforeach;
          if ( empty( $initial['items'] ) ): ?>
            <tr><td colspan="<?= (int) $col_count ?>" class="hld-dir-empty">No listings yet.</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="hld-dir-pagination" id="hld-pagination" <?= $initial['pages'] <= 1 ? 'style="display:none"' : '' ?>>
      <button class="hld-dir-pgbtn" id="hld-prev" disabled>← Prev</button>
      <span id="hld-pager">Page 1 of <?= (int) $initial['pages'] ?></span>
      <button class="hld-dir-pgbtn" id="hld-next" <?= $initial['pages'] <= 1 ? 'disabled' : '' ?>>Next →</button>
    </div>
  </div>

  <?php endif; ?>

</div>

<!-- ═══════════════════════════════════════════════════
     LIST YOUR LISTING — ENQUIRY MODAL
═══════════════════════════════════════════════════ -->
<div id="hld-enquiry-overlay" class="hl-directory hld-enq-overlay" style="display:none;" aria-modal="true" role="dialog" aria-labelledby="hld-enq-title">
  <div class="hld-enq-modal">

    <div class="hld-enq-modal__header">
      <div>
        <h2 class="hld-enq-modal__title" id="hld-enq-title">Join HarnessLink</h2>
        <p class="hld-enq-modal__sub">Have your business listed on the global HarnessLink platform. Send your details and our team will review your enquiry.</p>
      </div>
      <button class="hld-enq-close" id="hld-enq-close" aria-label="Close">✕</button>
    </div>

    <div class="hld-enq-modal__body">

      <div id="hld-enq-form">

        <div class="hld-enq-form-grid">

          <!-- Listing type -->
          <div class="hld-enq-field hld-enq-field--full">
            <label for="enq-pub-listing_type">I want to list a… <span class="req">*</span></label>
            <select id="enq-pub-listing_type" class="hld-enq-select">
              <option value="">— Select listing type —</option>
              <?php foreach ( HLD_Types::get_all( true ) as $slug => $opt ): ?>
                <option value="<?= esc_attr( wp_strip_all_tags( $opt['singular'] ) ) ?>" <?= $slug === $active_slug ? 'selected' : '' ?>>
                  <?= wp_kses( $opt['singular'], array() ) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <!-- Contact name -->
          <div class="hld-enq-field">
            <label for="enq-pub-contact_name">Your Name <span class="req">*</span></label>
            <input type="text" id="enq-pub-contact_name" placeholder="e.g. Alan Galloway" />
          </div>

          <!-- Email -->
          <div class="hld-enq-field">
            <label for="enq-pub-contact_email">Email Address <span class="req">*</span></label>
            <input type="email" id="enq-pub-contact_email" placeholder="you@yourbusiness.com" />
          </div>

          <!-- Phone -->
          <div class="hld-enq-field">
            <label for="enq-pub-contact_phone">Phone Number</label>
            <input type="tel" id="enq-pub-contact_phone" placeholder="+61 3 5555 1234" />
          </div>

          <!-- Stud / listing name -->
          <div class="hld-enq-field">
            <label for="enq-pub-stud_name">Business / Listing Name</label>
            <input type="text" id="enq-pub-stud_name" placeholder="e.g. Alabar Bloodstock" />
          </div>

          <!-- Country -->
          <div class="hld-enq-field">
            <label for="enq-pub-country">Country</label>
            <input type="text" id="enq-pub-country" placeholder="e.g. Australia" />
          </div>

          <!-- Region -->
          <div class="hld-enq-field">
            <label for="enq-pub-region">State / Region</label>
            <input type="text" id="enq-pub-region" placeholder="e.g. VIC" />
          </div>

          <!-- Message -->
          <div class="hld-enq-field hld-enq-field--full">
            <label for="enq-pub-message">Anything else you'd like to share?</label>
            <textarea id="enq-pub-message" rows="4" placeholder="Tell us about your listing — services, location, contact preferences…"></textarea>
          </div>

        </div>

        <div id="hld-enq-error" class="hld-enq-error" style="display:none;"></div>

      </div>

      <!-- Success state -->
      <div id="hld-enq-success" class="hld-enq-success" style="display:none;">
        <div class="hld-enq-success__icon">✓</div>
        <h3>Enquiry Received!</h3>
        <p>Thanks for reaching out. A member of the HarnessLink team will be in touch shortly to discuss your listing.</p>
      </div>

    </div>

    <div class="hld-enq-modal__footer" id="hld-enq-footer">
      <button class="hld-enq-btn hld-enq-btn--ghost" id="hld-enq-cancel">Cancel</button>
      <button class="hld-enq-btn hld-enq-btn--primary" id="hld-enq-submit">Submit Enquiry</button>
    </div>

  </div>
</div>

<?php if ( $standalone ) get_footer(); ?>
