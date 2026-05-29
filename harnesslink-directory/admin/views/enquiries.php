<?php if ( ! defined( 'ABSPATH' ) ) exit;

global $wpdb;
$counts = array(
    'all'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}hld_enquiries" ),
    'new'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}hld_enquiries WHERE status = 'new'" ),
    'contacted' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}hld_enquiries WHERE status = 'contacted'" ),
    'converted' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}hld_enquiries WHERE status = 'converted'" ),
    'dismissed' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}hld_enquiries WHERE status = 'dismissed'" ),
);
$current_status = sanitize_text_field( $_GET['status'] ?? '' );
?>
<div class="wrap hld-wrap">

  <div class="hld-admin-header">
    <div class="hld-admin-header__brand">
      <span class="hld-logo">HL</span>
      <div>
        <h1>Listing Enquiries</h1>
        <p>Review and action inbound listing requests. Contact the enquirer, arrange payment, then upgrade their listing.</p>
      </div>
    </div>
  </div>

  <!-- Status filter tabs -->
  <div class="hld-enq-status-tabs">
    <?php
    $tabs = array(
      ''          => 'All',
      'new'       => 'New',
      'contacted' => 'Contacted',
      'converted' => 'Converted',
      'dismissed' => 'Dismissed',
    );
    foreach ( $tabs as $val => $label ):
      $active = ( $current_status === $val ) ? 'active' : '';
      $count  = $val === '' ? $counts['all'] : ( $counts[$val] ?? 0 );
      $url    = admin_url( 'admin.php?page=hld-enquiries' . ( $val ? '&status=' . $val : '' ) );
    ?>
      <a href="<?= esc_url($url) ?>" class="hld-enq-tab <?= $active ?>">
        <?= $label ?>
        <span class="hld-enq-tab-count"><?= $count ?></span>
      </a>
    <?php endforeach; ?>
  </div>

  <!-- Enquiries table -->
  <div class="hld-table-wrap">
    <table class="hld-table">
      <thead>
        <tr>
          <th>Contact</th>
          <th>Listing Type</th>
          <th>Stud / Name</th>
          <th>Country / Region</th>
          <th>Status</th>
          <th>Received</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php if ( empty( $result['items'] ) ): ?>
          <tr><td colspan="7" class="hld-empty">No enquiries found.</td></tr>
        <?php else: foreach ( $result['items'] as $e ): ?>
          <tr data-id="<?= $e->id ?>" class="hld-enq-row <?= $e->status === 'new' ? 'hld-enq-row--new' : '' ?>">
            <td>
              <strong><?= esc_html( $e->contact_name ) ?></strong>
              <?php if ( $e->status === 'new' ): ?>
                <span class="hld-new-dot" title="New enquiry">●</span>
              <?php endif; ?>
              <div class="hld-smeta">
                <a href="mailto:<?= esc_attr($e->contact_email) ?>"><?= esc_html($e->contact_email) ?></a>
                <?php if ( $e->contact_phone ): ?>
                  · <?= esc_html($e->contact_phone) ?>
                <?php endif; ?>
              </div>
            </td>
            <td>
              <span class="hld-pill hld-pill--<?= strtolower($e->listing_type) ?>"><?= esc_html($e->listing_type) ?></span>
            </td>
            <td><?= esc_html( $e->stud_name ) ?: '—' ?></td>
            <td><?= esc_html( $e->country ) ?><?= $e->region ? ' / ' . esc_html($e->region) : '' ?></td>
            <td>
              <span class="hld-enq-status hld-enq-status--<?= $e->status ?>">
                <?= ucfirst($e->status) ?>
              </span>
            </td>
            <td class="hld-smeta"><?= esc_html( date( 'd M Y', strtotime($e->submitted_at) ) ) ?></td>
            <td class="hld-actions">
              <button class="hld-btn hld-btn--xs hld-btn--secondary hld-enq-view" data-id="<?= $e->id ?>">View</button>
              <button class="hld-btn hld-btn--xs hld-btn--danger hld-enq-delete" data-id="<?= $e->id ?>" data-name="<?= esc_attr($e->contact_name) ?>">Delete</button>
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
        $base_args    = array( 'page' => 'hld-enquiries' );
        if ( $current_status !== '' ) $base_args['status'] = $current_status;
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
     ENQUIRY DETAIL MODAL
═══════════════════════════════════════════════════ -->
<div id="hld-enq-modal-overlay" class="hld-modal-overlay" style="display:none;">
  <div class="hld-modal hld-modal--wide">
    <div class="hld-modal__header">
      <h2>Enquiry Detail</h2>
      <button class="hld-modal-close" id="hld-enq-modal-close">✕</button>
    </div>

    <div class="hld-modal__body">

      <!-- Contact summary -->
      <div class="hld-enq-detail-grid">
        <div class="hld-enq-detail-section">
          <div class="hld-enq-detail-label">Contact Name</div>
          <div class="hld-enq-detail-val" id="enq-contact_name">—</div>
        </div>
        <div class="hld-enq-detail-section">
          <div class="hld-enq-detail-label">Email</div>
          <div class="hld-enq-detail-val"><a id="enq-contact_email" href="#">—</a></div>
        </div>
        <div class="hld-enq-detail-section">
          <div class="hld-enq-detail-label">Phone</div>
          <div class="hld-enq-detail-val" id="enq-contact_phone">—</div>
        </div>
        <div class="hld-enq-detail-section">
          <div class="hld-enq-detail-label">Listing Type</div>
          <div class="hld-enq-detail-val" id="enq-listing_type">—</div>
        </div>
        <div class="hld-enq-detail-section">
          <div class="hld-enq-detail-label">Stud / Name</div>
          <div class="hld-enq-detail-val" id="enq-stud_name">—</div>
        </div>
        <div class="hld-enq-detail-section">
          <div class="hld-enq-detail-label">Country / Region</div>
          <div class="hld-enq-detail-val" id="enq-location">—</div>
        </div>
      </div>

      <!-- Message -->
      <div class="hld-enq-message-wrap">
        <div class="hld-enq-detail-label">Their Message</div>
        <div class="hld-enq-message" id="enq-message">—</div>
      </div>

      <!-- Admin section -->
      <div class="hld-enq-admin-section">
        <div class="hld-enq-detail-label">Update Status</div>
        <div class="hld-enq-status-row">
          <select id="enq-status" class="hld-dir-select" style="height:40px;">
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted — listing upgraded</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div class="hld-enq-detail-label" style="margin-top:14px;">Internal Notes</div>
        <textarea id="enq-admin_notes" rows="4" placeholder="e.g. Called 22 May, sending invoice..." style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;resize:vertical;"></textarea>
      </div>

      <!-- Quick-copy email prompt -->
      <div class="hld-enq-quick-email">
        <div class="hld-enq-detail-label">Quick Actions</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
          <a id="enq-mailto" href="#" class="hld-btn hld-btn--secondary hld-btn--xs">Send Email</a>
          <a id="enq-stallions-link" href="<?= admin_url('admin.php?page=hld-dashboard') ?>" class="hld-btn hld-btn--secondary hld-btn--xs">+ Add their Stallion</a>
        </div>
      </div>

    </div>

    <div class="hld-modal__footer">
      <button class="hld-btn hld-btn--ghost" id="hld-enq-modal-cancel">Close</button>
      <button class="hld-btn hld-btn--primary" id="hld-enq-save">Save Changes</button>
    </div>

    <input type="hidden" id="enq-id" value="" />
  </div>
</div>
