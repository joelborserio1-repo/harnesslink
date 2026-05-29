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
        <button class="hld-tab active" data-tab="basic">Basic Info</button>
        <button class="hld-tab" data-tab="contact">Contact Details</button>
        <button class="hld-tab" data-tab="profile">Profile & Racing</button>
      </div>

      <!-- TAB: Basic Info -->
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
          <div class="hld-field" data-field="stud_name" data-stallion-only="1">
            <label>Organisation / Stud</label>
            <input type="text" id="hld-stud_name" placeholder="e.g. Alabar Bloodstock" />
          </div>
          <div class="hld-field" data-field="stud_master" data-stallion-only="1">
            <label>Stud Master</label>
            <input type="text" id="hld-stud_master" placeholder="e.g. Alan Galloway" />
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
          <div class="hld-field hld-field--full" data-field="coverage">
            <label>Coverage</label>
            <textarea id="hld-coverage" rows="3" placeholder="e.g. Routes travelled / locations covered / delivery areas"></textarea>
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
            <label>Profile Bio</label>
            <textarea id="hld-profile_bio" rows="5" placeholder="About this stallion..."></textarea>
          </div>
          <div class="hld-field hld-field--full">
            <label>Profile Picture URL</label>
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
            <label>Progeny Note</label>
            <textarea id="hld-progeny_note" rows="3" placeholder="Notable progeny..."></textarea>
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
