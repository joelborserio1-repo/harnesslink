<?php if ( ! defined( 'ABSPATH' ) ) exit;
/* $active_type is provided by HLD_Admin::page_stallions() */
$active_type   = isset( $active_type ) ? $active_type : 'stallion';
$type_meta     = HLD_Types::get( $active_type );
$supports_gait = ! empty( $type_meta['supports_gait'] );
$singular      = wp_strip_all_tags( $type_meta['singular'] );
$plural        = wp_strip_all_tags( $type_meta['plural'] );
?>
<div class="wrap hld-wrap">

  <div class="hld-admin-header">
    <div class="hld-admin-header__brand">
      <span class="hld-logo">HL</span>
      <div>
        <h1><?= esc_html( $plural ) ?> Directory</h1>
        <p>Manage <?= esc_html( strtolower( $plural ) ) ?> listings, paying status and contact details.</p>
      </div>
    </div>
    <button class="hld-btn hld-btn--primary" id="hld-add-new">+ Add <?= esc_html( $singular ) ?></button>
  </div>

  <!-- Directory type switcher -->
  <div class="hld-search-bar" style="margin-bottom:14px;">
    <form method="get">
      <input type="hidden" name="page" value="hld-dashboard" />
      <label style="font-weight:600;margin-right:8px;">Directory type:</label>
      <select name="dtype" onchange="this.form.submit()" class="hld-search-input" style="max-width:280px;">
        <?php foreach ( HLD_Types::get_all() as $slug => $t ): ?>
          <option value="<?= esc_attr( $slug ) ?>" <?= $slug === $active_type ? 'selected' : '' ?>>
            <?= esc_html( wp_strip_all_tags( $t['plural'] ) ) ?> (<?= esc_html( $slug ) ?>)
          </option>
        <?php endforeach; ?>
      </select>
      <a href="<?= esc_url( admin_url( 'admin.php?page=hld-types' ) ) ?>" class="hld-btn hld-btn--ghost">Manage types</a>
    </form>
  </div>

  <!-- Stats bar -->
  <div class="hld-stats">
    <?php
      global $wpdb;
      $tbl     = $wpdb->prefix . 'hld_stallions';
      $total   = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tbl} WHERE directory_type = %s", $active_type ) );
      $paying  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tbl} WHERE directory_type = %s AND is_paying = 1", $active_type ) );
      $featured= (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tbl} WHERE directory_type = %s AND is_featured = 1", $active_type ) );
      $pacers  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tbl} WHERE directory_type = %s AND type = 'Pacer'", $active_type ) );
      $trotters= (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tbl} WHERE directory_type = %s AND type = 'Trotter'", $active_type ) );
    ?>
    <div class="hld-stat">
      <span class="hld-stat__num"><?= $total ?></span>
      <span class="hld-stat__label">Total Listings</span>
    </div>
    <div class="hld-stat hld-stat--green">
      <span class="hld-stat__num"><?= $paying ?></span>
      <span class="hld-stat__label">Paying</span>
    </div>
    <div class="hld-stat hld-stat--green">
      <span class="hld-stat__num"><?= $featured ?></span>
      <span class="hld-stat__label">Featured</span>
    </div>
    <?php if ( $supports_gait ): ?>
    <div class="hld-stat">
      <span class="hld-stat__num"><?= $pacers ?></span>
      <span class="hld-stat__label">Pacers</span>
    </div>
    <div class="hld-stat">
      <span class="hld-stat__num"><?= $trotters ?></span>
      <span class="hld-stat__label">Trotters</span>
    </div>
    <?php endif; ?>
  </div>

  <!-- Search bar -->
  <div class="hld-search-bar">
    <form method="get">
      <input type="hidden" name="page" value="hld-dashboard" />
      <input type="hidden" name="dtype" value="<?= esc_attr( $active_type ) ?>" />
      <input type="text" name="s" value="<?= esc_attr( $_GET['s'] ?? '' ) ?>" placeholder="Search name, organisation, country..." class="hld-search-input" />
      <button type="submit" class="hld-btn hld-btn--secondary">Search</button>
      <?php if ( ! empty( $_GET['s'] ) ): ?>
        <a href="?page=hld-dashboard&dtype=<?= esc_attr( $active_type ) ?>" class="hld-btn hld-btn--ghost">Clear</a>
      <?php endif; ?>
    </form>
  </div>

  <!-- Table -->
  <div class="hld-table-wrap">
    <table class="hld-table">
      <?php $admin_cols = $supports_gait ? 7 : 6; ?>
      <thead>
        <tr>
          <th><?= esc_html( $type_meta['name_label'] ) ?></th>
          <th><?= esc_html( $type_meta['org_label'] ) ?></th>
          <th>Country / Region</th>
          <?php if ( $supports_gait ): ?><th>Stud Master</th><th>Gait</th><?php endif; ?>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="hld-table-body">
        <?php if ( empty( $result['items'] ) ): ?>
          <tr><td colspan="<?= (int) $admin_cols ?>" class="hld-empty">No listings found. <a href="#" id="hld-add-new-inline">Add your first one.</a></td></tr>
        <?php else: foreach ( $result['items'] as $s ): ?>
          <tr data-id="<?= $s->id ?>">
            <td>
              <strong class="hld-sname"><?= esc_html( $s->name ) ?></strong>
              <?php if ( $s->status_note ): ?>
                <div class="hld-smeta"><?= esc_html( $s->status_note ) ?></div>
              <?php endif; ?>
            </td>
            <td><?= esc_html( $s->stud_name ) ?></td>
            <td><?= esc_html( $s->country ) ?><?= $s->region ? ' / ' . esc_html( $s->region ) : '' ?></td>
            <?php if ( $supports_gait ): ?>
            <td><?= esc_html( $s->stud_master ) ?></td>
            <td><span class="hld-pill hld-pill--<?= strtolower($s->type) ?>"><?= esc_html( $s->type ) ?></span></td>
            <?php endif; ?>
            <td>
              <?php if ( $s->is_paying ): ?>
                <span class="hld-status hld-status--paying">✓ Paying</span>
              <?php else: ?>
                <span class="hld-status hld-status--free">Free Listing</span>
              <?php endif; ?>
              <?php if ( ! empty( $s->is_featured ) ): ?>
                <span class="hld-status hld-status--paying">Featured Stud</span>
              <?php endif; ?>
            </td>
            <td class="hld-actions">
              <button class="hld-btn hld-btn--xs hld-btn--secondary hld-edit" data-id="<?= $s->id ?>">Edit</button>
              <button class="hld-btn hld-btn--xs hld-btn--danger hld-delete" data-id="<?= $s->id ?>" data-name="<?= esc_attr( $s->name ) ?>">Delete</button>
            </td>
          </tr>
        <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  <?php if ( $result['pages'] > 1 ): ?>
    <div class="hld-pagination">
      <?php
        $current_page = max( 1, (int) ( $result['page'] ?? 1 ) );
        $search_term  = sanitize_text_field( $_GET['s'] ?? '' );
        $base_args    = array( 'page' => 'hld-dashboard', 'dtype' => $active_type );
        if ( $search_term !== '' ) $base_args['s'] = $search_term;
      ?>
      <a href="<?= esc_url( add_query_arg( array_merge( $base_args, array( 'paged' => max( 1, $current_page - 1 ) ) ), admin_url( 'admin.php' ) ) ) ?>"
         class="hld-page-btn <?= $current_page <= 1 ? 'disabled' : '' ?>">‹ Prev</a>
      <?php for ( $i = 1; $i <= $result['pages']; $i++ ): ?>
        <a href="<?= esc_url( add_query_arg( array_merge( $base_args, array( 'paged' => $i ) ), admin_url( 'admin.php' ) ) ) ?>"
           class="hld-page-btn <?= $i === $current_page ? 'active' : '' ?>">
          <?= $i ?>
        </a>
      <?php endfor; ?>
      <a href="<?= esc_url( add_query_arg( array_merge( $base_args, array( 'paged' => min( (int) $result['pages'], $current_page + 1 ) ) ), admin_url( 'admin.php' ) ) ) ?>"
         class="hld-page-btn <?= $current_page >= (int) $result['pages'] ? 'disabled' : '' ?>">Next ›</a>
    </div>
  <?php endif; ?>

</div>

<!-- ═══════════════════════════════════════════════════
     ADD / EDIT MODAL
═══════════════════════════════════════════════════ -->
<div id="hld-modal-overlay" class="hld-modal-overlay" style="display:none;">
  <div class="hld-modal">
    <div class="hld-modal__header">
      <h2 id="hld-modal-title">Add Stallion</h2>
      <button class="hld-modal-close" id="hld-modal-close">✕</button>
    </div>

    <div class="hld-modal__body">
      <input type="hidden" id="hld-id" value="" />

      <div class="hld-modal-tabs">
        <button class="hld-tab active" data-tab="basic">Overview</button>
        <button class="hld-tab" data-tab="contact">Contact Details</button>
        <button class="hld-tab" data-tab="profile">Profile & Racing</button>
        <button class="hld-tab" data-tab="images" data-stallion-only="1">Images</button>
        <button class="hld-tab" data-tab="pedigree" data-stallion-only="1">Pedigree</button>
        <button class="hld-tab" data-tab="content" data-stallion-only="1">Content</button>
        <button class="hld-tab" data-tab="media" data-stallion-only="1">Media</button>
        <button class="hld-tab" data-tab="related" data-stallion-only="1">Related Horses</button>
        <button class="hld-tab" data-tab="progeny" data-stallion-only="1">Progeny</button>
      </div>

      <!-- TAB: Overview -->
      <div class="hld-tab-panel active" id="hld-tab-basic">
        <div class="hld-form-grid">
          <div class="hld-field hld-field--full">
            <label>Directory Type <span class="req">*</span></label>
            <select id="hld-directory_type" data-default="<?= esc_attr( $active_type ) ?>">
              <?php foreach ( HLD_Types::get_all() as $slug => $t ): ?>
                <option value="<?= esc_attr( $slug ) ?>" <?= $slug === $active_type ? 'selected' : '' ?>>
                  <?= esc_html( wp_strip_all_tags( $t['singular'] ) ) ?> (<?= esc_html( $slug ) ?>)
                </option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="hld-field hld-field--full">
            <label>Name <span class="req">*</span></label>
            <input type="text" id="hld-name" placeholder="e.g. Always B Miki USA" />
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>Tagline</label>
            <p class="hld-field-hint">A short descriptor shown under the horse's name, e.g. "Australia's leading first-crop sire".</p>
            <input type="text" id="hld-tagline" placeholder="e.g. World Champion Pacer" />
          </div>
          <div class="hld-field" data-field="stud_name" data-stallion-only="1">
            <label>Standing Farm / Stud</label>
            <input type="text" id="hld-stud_name" placeholder="e.g. Alabar Bloodstock" />
          </div>
          <div class="hld-field" data-field="stud_master" data-stallion-only="1">
            <label>Stud Master</label>
            <input type="text" id="hld-stud_master" placeholder="e.g. Alan Galloway" />
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Year of Birth</label>
            <input type="text" id="hld-year_of_birth" maxlength="10" placeholder="e.g. 2011" />
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Colour</label>
            <input type="text" id="hld-colour" placeholder="e.g. Bay" />
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Sex</label>
            <input type="text" id="hld-sex" placeholder="e.g. Stallion, Mare, Gelding" />
          </div>
          <div class="hld-field" data-field="industry">
            <label>Industry Involvement</label>
            <input type="text" id="hld-industry" placeholder="e.g. Saddlery & harness supplies" />
          </div>
          <div class="hld-field" data-field="suburb">
            <label>Suburb</label>
            <input type="text" id="hld-suburb" placeholder="e.g. Werribee" />
          </div>
          <div class="hld-field" data-field="region">
            <label>Region / State</label>
            <input type="text" id="hld-region" placeholder="e.g. VIC" />
          </div>
          <div class="hld-field" data-field="country">
            <label>Country</label>
            <select id="hld-country">
              <option value="Australia">Australia</option>
              <option value="New Zealand">New Zealand</option>
              <option value="USA">USA</option>
              <option value="France">France</option>
            </select>
          </div>
          <div class="hld-field" data-field="type" data-stallion-only="1">
            <label>Gait</label>
            <select id="hld-type">
              <option value="Pacer">Pacer</option>
              <option value="Trotter">Trotter</option>
            </select>
          </div>
          <div class="hld-field">
            <label>Status Note</label>
            <input type="text" id="hld-status_note" placeholder="e.g. Standing at stud" />
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Service Fee</label>
            <p class="hld-field-hint">Leave blank if no service fee is being displayed.</p>
            <input type="text" id="hld-service_fee" placeholder="e.g. $8,800 (inc GST)" />
          </div>
          <div class="hld-field hld-field--full" data-field="coverage">
            <label>Coverage</label>
            <textarea id="hld-coverage" rows="3" placeholder="e.g. Routes travelled / locations covered / delivery areas"></textarea>
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>Short Summary</label>
            <p class="hld-field-hint">A one or two sentence pedigree summary shown in the name/summary block on the profile.</p>
            <textarea id="hld-short_summary" rows="2" placeholder="e.g. By Sweet Lou out of a Bettor's Delight mare, undefeated at two."></textarea>
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Booking / Contact Button Label</label>
            <input type="text" id="hld-booking_label" placeholder="e.g. Book a Service" />
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Booking / Contact URL</label>
            <input type="url" id="hld-booking_url" placeholder="https://..." />
          </div>
          <div class="hld-field hld-field--full">
            <label class="hld-toggle-label">
              <input type="checkbox" id="hld-is_paying" />
              <span class="hld-toggle-text">
                <strong>Paying Listing</strong> — enables profile link, contact details, and full listing features
              </span>
            </label>
          </div>
          <div class="hld-field hld-field--full">
            <label class="hld-toggle-label">
              <input type="checkbox" id="hld-is_featured" />
              <span class="hld-toggle-text">
                <strong>Featured Listing</strong> — premium placement shown first in the directory and highlighted on the profile
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- TAB: Contact Details -->
      <div class="hld-tab-panel" id="hld-tab-contact">
        <p class="hld-tab-note">Contact details are visible on the public profile for <strong>paying studs</strong>. Add the stallion's direct website page and regional stud contact blocks.</p>
        <div class="hld-form-grid">
          <div class="hld-field">
            <label>Phone</label>
            <input type="text" id="hld-contact_phone" placeholder="+61 3 5555 1234" />
          </div>
          <div class="hld-field">
            <label>Email</label>
            <input type="email" id="hld-contact_email" placeholder="info@business.com.au" />
          </div>
          <div class="hld-field hld-field--full" data-field="contact_website">
            <label>Website</label>
            <input type="url" id="hld-contact_website" placeholder="https://business.com/" />
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>Stud Website</label>
            <input type="url" id="hld-stud_website" placeholder="https://studname.com/" />
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>AU Contact</label>
            <textarea id="hld-contact_au" rows="4" placeholder="Stud name&#10;Phone&#10;Email&#10;Address"></textarea>
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>US Contact</label>
            <textarea id="hld-contact_us" rows="4" placeholder="Stud name&#10;Phone&#10;Email&#10;Address"></textarea>
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>NZ Contact</label>
            <textarea id="hld-contact_nz" rows="4" placeholder="Stud name&#10;Phone&#10;Email&#10;Address"></textarea>
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>FR Contact</label>
            <textarea id="hld-contact_fr" rows="4" placeholder="Stud name&#10;Phone&#10;Email&#10;Address"></textarea>
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>Other / Fallback Contact</label>
            <textarea id="hld-contact_other" rows="4" placeholder="Stud name&#10;Phone&#10;Email&#10;Address"></textarea>
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>Fallback Address</label>
            <textarea id="hld-contact_address" rows="3" placeholder="123 Stud Lane, Werribee VIC 3030"></textarea>
          </div>
        </div>
      </div>

      <!-- TAB: Profile & Racing -->
      <div class="hld-tab-panel" id="hld-tab-profile">
        <p class="hld-tab-note">Profile page content is only visible for <strong>paying studs</strong>.</p>
        <div class="hld-form-grid">
          <div class="hld-field hld-field--full">
            <label>Profile Bio (About the Horse)</label>
            <textarea id="hld-profile_bio" rows="5" placeholder="About this stallion..."></textarea>
          </div>
          <div class="hld-field hld-field--full">
            <label>Profile Picture URL</label>
            <p class="hld-field-hint" data-stallion-only="1">For stallions this is only used as a fallback if no Hero Image is set on the Images tab.</p>
            <div class="hld-image-picker">
              <input type="text" id="hld-profile_image" placeholder="https://..." />
              <button type="button" class="hld-btn hld-btn--secondary" id="hld-profile-image-pick">Upload / Choose Image</button>
              <button type="button" class="hld-btn hld-btn--ghost" id="hld-profile-image-clear">Clear</button>
            </div>
            <div class="hld-image-preview" id="hld-profile-image-preview" style="display:none;">
              <img src="" alt="Profile picture preview" />
            </div>
          </div>
          <div class="hld-field" data-stallion-only="1">
            <label>Race Record</label>
            <input type="text" id="hld-race_record" placeholder="e.g. 1:46.4 | 3,4 (1:46)" />
          </div>
          <div class="hld-field hld-field--full" data-stallion-only="1">
            <label>Progeny Note (fallback text)</label>
            <textarea id="hld-progeny_note" rows="3" placeholder="Optional free-text progeny note. Shown only if no structured progeny table exists."></textarea>
          </div>
        </div>
      </div>

      <!-- TAB: Images -->
      <div class="hld-tab-panel" id="hld-tab-images">
        <p class="hld-tab-note">The Hero Image is the large image at the top of the profile. Gallery images appear as additional carousel/thumbnail photos. Upload a wide promotional banner if you want one — leave it blank to show nothing.</p>

        <h3 class="hld-panel-heading">Hero Image</h3>
        <div class="hld-form-grid">
          <div class="hld-field hld-field--full">
            <input type="hidden" id="hld-hero_image_id" value="0" />
            <div class="hld-image-picker">
              <button type="button" class="hld-btn hld-btn--secondary" id="hld-hero-image-pick">Upload / Choose Image</button>
              <button type="button" class="hld-btn hld-btn--ghost" id="hld-hero-image-clear">Clear</button>
            </div>
            <div class="hld-image-preview" id="hld-hero-image-preview" style="display:none;">
              <img src="" alt="Hero image preview" />
            </div>
          </div>
        </div>

        <h3 class="hld-panel-heading">Gallery Images</h3>
        <div id="hld-gallery-needs-save" class="hld-tab-note" style="display:none;color:#B45309;">Save the horse first, then return to this tab to add gallery images.</div>
        <div class="hld-gallery-add-row">
          <div class="hld-gallery-add-group">
            <button type="button" class="hld-btn hld-btn--secondary" id="hld-gallery-media-btn">Upload / Choose from Media Library</button>
            <span class="hld-gallery-or">or</span>
            <div class="hld-gallery-url-group">
              <input type="text" id="hld-gallery-url-input" placeholder="Paste an image URL…" />
              <button type="button" class="hld-btn hld-btn--secondary" id="hld-gallery-url-add">Add</button>
            </div>
          </div>
        </div>
        <p class="hld-gallery-note" id="hld-gallery-empty-note">No gallery images added yet.</p>
        <p class="hld-gallery-hint" id="hld-gallery-hint" style="display:none;">Drag cards to reorder. The first image doubles as the fallback if no Hero Image is set.</p>
        <div class="hld-gallery-grid" id="hld-gallery-grid"></div>

        <h3 class="hld-panel-heading">Promotional Banner</h3>
        <p class="hld-field-hint">Optional full-width banner shown below the summary block. Leave the image empty to show nothing — an incomplete banner (e.g. a link with no image) will not display.</p>
        <div class="hld-form-grid">
          <div class="hld-field hld-field--full">
            <input type="hidden" id="hld-banner_image_id" value="0" />
            <div class="hld-image-picker">
              <button type="button" class="hld-btn hld-btn--secondary" id="hld-banner-image-pick">Upload / Choose Banner Image</button>
              <button type="button" class="hld-btn hld-btn--ghost" id="hld-banner-image-clear">Clear</button>
            </div>
            <div class="hld-image-preview hld-image-preview--wide" id="hld-banner-image-preview" style="display:none;">
              <img src="" alt="Banner preview" />
            </div>
          </div>
          <div class="hld-field hld-field--full">
            <label>Banner Alt Text</label>
            <input type="text" id="hld-banner_alt" placeholder="Describe the banner image for screen readers" />
          </div>
          <div class="hld-field">
            <label>Banner Link URL</label>
            <input type="url" id="hld-banner_url" placeholder="https://..." />
          </div>
          <div class="hld-field">
            <label>Open Link In</label>
            <select id="hld-banner_target">
              <option value="_self">Same tab</option>
              <option value="_blank">New tab</option>
            </select>
          </div>
          <div class="hld-field">
            <label>Start Date</label>
            <p class="hld-field-hint">Leave blank to show immediately.</p>
            <input type="date" id="hld-banner_start" />
          </div>
          <div class="hld-field">
            <label>End Date</label>
            <p class="hld-field-hint">Leave blank to show indefinitely.</p>
            <input type="date" id="hld-banner_end" />
          </div>
        </div>
      </div>

      <!-- TAB: Pedigree -->
      <div class="hld-tab-panel" id="hld-tab-pedigree">
        <p class="hld-tab-note">Paste each ancestor's name only — no extra formatting. Leave any field blank to omit it cleanly from the pedigree table. Publishing is never blocked by incomplete pedigree fields.</p>

        <h3 class="hld-panel-heading">Parents</h3>
        <div class="hld-form-grid">
          <div class="hld-field"><label>Sire</label><input type="text" id="hld-ped_sire" placeholder="e.g. Sweet Lou" /></div>
          <div class="hld-field"><label>Dam</label><input type="text" id="hld-ped_dam" placeholder="e.g. Shesalight" /></div>
        </div>

        <h3 class="hld-panel-heading">Grandparents</h3>
        <div class="hld-form-grid">
          <div class="hld-field"><label>Sire &gt; Sire</label><input type="text" id="hld-ped_ss" /></div>
          <div class="hld-field"><label>Sire &gt; Dam</label><input type="text" id="hld-ped_sd" /></div>
          <div class="hld-field"><label>Dam &gt; Sire</label><input type="text" id="hld-ped_ds" /></div>
          <div class="hld-field"><label>Dam &gt; Dam</label><input type="text" id="hld-ped_dd" /></div>
        </div>

        <h3 class="hld-panel-heading">Great-Grandparents</h3>
        <div class="hld-form-grid">
          <div class="hld-field"><label>Sire &gt; Sire &gt; Sire</label><input type="text" id="hld-ped_sss" /></div>
          <div class="hld-field"><label>Sire &gt; Sire &gt; Dam</label><input type="text" id="hld-ped_ssd" /></div>
          <div class="hld-field"><label>Sire &gt; Dam &gt; Sire</label><input type="text" id="hld-ped_sds" /></div>
          <div class="hld-field"><label>Sire &gt; Dam &gt; Dam</label><input type="text" id="hld-ped_sdd" /></div>
          <div class="hld-field"><label>Dam &gt; Sire &gt; Sire</label><input type="text" id="hld-ped_dss" /></div>
          <div class="hld-field"><label>Dam &gt; Sire &gt; Dam</label><input type="text" id="hld-ped_dsd" /></div>
          <div class="hld-field"><label>Dam &gt; Dam &gt; Sire</label><input type="text" id="hld-ped_dds" /></div>
          <div class="hld-field"><label>Dam &gt; Dam &gt; Dam</label><input type="text" id="hld-ped_ddd" /></div>
        </div>
      </div>

      <!-- TAB: Content -->
      <div class="hld-tab-panel" id="hld-tab-content">
        <p class="hld-tab-note">"About the Horse" is edited on the <strong>Profile & Racing</strong> tab (Profile Bio field) — it's shared with every listing type. Use this tab for the "Crosses of Gold" breeding-cross section shown alongside it.</p>

        <h3 class="hld-panel-heading">Crosses of Gold — Introduction</h3>
        <div class="hld-form-grid">
          <div class="hld-field hld-field--full">
            <textarea id="hld-crosses_intro" rows="3" placeholder="Optional intro paragraph shown above the list of breeding crosses."></textarea>
          </div>
        </div>

        <h3 class="hld-panel-heading">Breeding Crosses</h3>
        <p class="hld-field-hint">Add one breeding cross per entry. Drag cards to reorder.</p>
        <div id="hld-crosses-needs-save" class="hld-tab-note" style="display:none;color:#B45309;">Save the horse first, then return to this tab to add breeding crosses.</div>
        <div id="hld-crosses-empty" class="hld-gallery-note">No breeding crosses added yet.</div>
        <div id="hld-crosses-list" class="hld-crosses-list"></div>
        <button type="button" class="hld-btn hld-btn--secondary" id="hld-cross-add">+ Add Breeding Cross</button>
      </div>

      <!-- TAB: Media -->
      <div class="hld-tab-panel" id="hld-tab-media">
        <p class="hld-tab-note">Add videos from YouTube, Vimeo, or upload a video file. Each video can have its own title and description. This section is hidden on the profile if no videos are added.</p>
        <div id="hld-media-needs-save" class="hld-tab-note" style="display:none;color:#B45309;">Save the horse first, then return to this tab to add videos.</div>

        <div class="hld-gallery-add-row">
          <div class="hld-gallery-add-group">
            <button type="button" class="hld-btn hld-btn--secondary" id="hld-media-library-btn">Upload a Video File</button>
            <span class="hld-gallery-or">or</span>
            <div class="hld-gallery-url-group">
              <input type="text" id="hld-media-url-input" placeholder="Paste a YouTube or Vimeo link…" />
              <button type="button" class="hld-btn hld-btn--secondary" id="hld-media-url-add">Add</button>
            </div>
          </div>
        </div>
        <p class="hld-gallery-note" id="hld-media-empty-note">No videos added yet.</p>
        <p class="hld-gallery-hint" id="hld-media-hint" style="display:none;">Drag cards to reorder. Add a title and description for each video.</p>
        <div class="hld-gallery-grid" id="hld-media-grid"></div>
      </div>

      <!-- TAB: Related Horses -->
      <div class="hld-tab-panel" id="hld-tab-related">
        <p class="hld-tab-note">Search and select up to a handful of related horses to feature on this profile. They must already exist as Stallion listings.</p>
        <input type="hidden" id="hld-related_ids" value="" />
        <div class="hld-field hld-field--full">
          <label>Search Horses</label>
          <input type="text" id="hld-related-search" placeholder="Start typing a horse name…" />
        </div>
        <div id="hld-related-results" class="hld-related-results"></div>
        <h3 class="hld-panel-heading">Selected</h3>
        <div id="hld-related-selected" class="hld-related-selected">
          <p class="hld-gallery-note" id="hld-related-empty-note">No related horses selected yet.</p>
        </div>
      </div>

      <!-- TAB: Progeny -->
      <div class="hld-tab-panel" id="hld-tab-progeny">
        <p class="hld-tab-note">Upload a progeny CSV for this stallion (Brendan's export format). Importing <strong>replaces</strong> this stallion's current progeny table. Columns: <code>Name, Foaling Date, Country of Birth, Sex, Dam, Broodmare Sire, Lifetime Prizemoney, Best Mile Rate, Starts, Wins</code>.</p>
        <div id="hld-progeny-needs-save" class="hld-tab-note" style="display:none;color:#B45309;">Save the stallion first, then return to this tab to import progeny.</div>
        <div class="hld-progeny-admin">
          <div class="hld-progeny-admin__bar">
            <label for="hld-progeny-file" class="hld-btn hld-btn--secondary">Choose CSV</label>
            <input type="file" id="hld-progeny-file" accept=".csv" style="display:none;" />
            <span id="hld-progeny-filename" class="hld-file-name"></span>
            <button type="button" class="hld-btn hld-btn--primary" id="hld-progeny-import" disabled>Import Progeny</button>
            <button type="button" class="hld-btn hld-btn--danger" id="hld-progeny-clear">Clear All</button>
            <a href="#" id="hld-progeny-sample" class="hld-btn hld-btn--ghost">Sample CSV</a>
          </div>
          <div id="hld-progeny-result" class="hld-import-result" style="display:none;"></div>
          <div class="hld-progeny-admin__count" id="hld-progeny-count">No progeny loaded yet.</div>
          <div class="hld-table-wrap" style="margin-top:10px;">
            <table class="hld-table hld-progeny-admin-table">
              <thead>
                <tr><th>Name</th><th>Foaled</th><th>Cty</th><th>Sex</th><th>Dam</th><th>B/M Sire</th><th>Prizemoney</th><th>Mile</th><th>Sts</th><th>Wins</th></tr>
              </thead>
              <tbody id="hld-progeny-tbody">
                <tr><td colspan="10" class="hld-empty">No progeny for this stallion.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="hld-modal__footer">
      <button class="hld-btn hld-btn--ghost" id="hld-modal-cancel">Cancel</button>
      <button class="hld-btn hld-btn--primary" id="hld-save-stallion">Save Listing</button>
    </div>
  </div>
</div>
