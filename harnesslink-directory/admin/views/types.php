<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap hld-wrap">

  <div class="hld-admin-header">
    <div class="hld-admin-header__brand">
      <span class="hld-logo">HL</span>
      <div>
        <h1>Directory Types</h1>
        <p>Manage the categories shown in the HarnessLink Directory. Add new categories here — no code required.</p>
      </div>
    </div>
    <button type="button" class="hld-btn hld-btn--primary" id="hld-type-add-new">+ Add Directory Type</button>
  </div>

  <?php if ( ! empty( $notice ) && is_array( $notice ) ): ?>
    <div class="notice notice-<?= $notice[0] === 'error' ? 'error' : 'success' ?> is-dismissible" style="margin:14px 0;">
      <p><?= esc_html( $notice[1] ) ?></p>
    </div>
  <?php endif; ?>

  <!-- Existing types -->
  <div class="hld-table-wrap">
    <table class="hld-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Slug</th>
          <th>Listings</th>
          <th>Gait</th>
          <th>Visible</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ( $types as $slug => $t ):
          $count = isset( $counts[ $slug ] ) ? (int) $counts[ $slug ] : 0; ?>
          <tr>
            <td>
              <strong class="hld-sname"><?= wp_kses( $t['plural'], array() ) ?></strong>
              <div class="hld-smeta"><?= wp_kses( $t['singular'], array() ) ?> · <?= esc_html( $t['name_label'] ) ?> / <?= esc_html( $t['org_label'] ) ?></div>
            </td>
            <td><code><?= esc_html( $slug ) ?></code><?php if ( ! empty( $t['builtin'] ) ): ?> <span class="hld-smeta">built-in</span><?php endif; ?></td>
            <td><?= $count ?></td>
            <td><?= ! empty( $t['supports_gait'] ) ? 'Yes' : '—' ?></td>
            <td>
              <?php if ( ! empty( $t['enabled'] ) ): ?>
                <span class="hld-status hld-status--paying">Visible</span>
              <?php else: ?>
                <span class="hld-status hld-status--free">Hidden</span>
              <?php endif; ?>
            </td>
            <td class="hld-actions">
              <button class="hld-btn hld-btn--xs hld-btn--secondary hld-type-edit"
                      data-type='<?= esc_attr( wp_json_encode( array( 'slug' => $slug ) + $t ) ) ?>'>Edit</button>
              <?php if ( empty( $t['builtin'] ) ): ?>
                <form method="post" style="display:inline" onsubmit="return confirm('Delete the &quot;<?= esc_attr( wp_strip_all_tags( $t['plural'] ) ) ?>&quot; type? Listings of this type will remain in the database but be hidden.');">
                  <?php wp_nonce_field( 'hld_types' ); ?>
                  <input type="hidden" name="hld_type_action" value="delete" />
                  <input type="hidden" name="slug" value="<?= esc_attr( $slug ) ?>" />
                  <button type="submit" class="hld-btn hld-btn--xs hld-btn--danger">Delete</button>
                </form>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <!-- Add / Edit form -->
  <div class="hld-settings-card" id="hld-type-form-card" style="margin-top:22px;">
    <h2 id="hld-type-form-title" style="margin-top:0;">Add Directory Type</h2>
    <form method="post">
      <?php wp_nonce_field( 'hld_types' ); ?>
      <input type="hidden" name="hld_type_action" value="save" />
      <input type="hidden" name="original_slug" id="hld-type-original_slug" value="" />

      <div class="hld-form-grid">
        <div class="hld-field">
          <label>Slug <span class="req">*</span></label>
          <p class="hld-field-hint">Lowercase, dashes only — used in URLs &amp; shortcodes. Cannot be changed for built-in types.</p>
          <input type="text" name="slug" id="hld-type-slug" placeholder="e.g. farrier" />
        </div>
        <div class="hld-field">
          <label>Sort Order</label>
          <p class="hld-field-hint">Lower numbers appear first in the navigation.</p>
          <input type="number" name="sort" id="hld-type-sort" value="500" />
        </div>
        <div class="hld-field">
          <label>Singular Label</label>
          <input type="text" name="singular" id="hld-type-singular" placeholder="e.g. Farrier" />
        </div>
        <div class="hld-field">
          <label>Plural Label</label>
          <input type="text" name="plural" id="hld-type-plural" placeholder="e.g. Farriers" />
        </div>
        <div class="hld-field">
          <label>Name Column Header</label>
          <p class="hld-field-hint">Header for the primary column (e.g. "Stallion", "Business").</p>
          <input type="text" name="name_label" id="hld-type-name_label" placeholder="e.g. Business" />
        </div>
        <div class="hld-field">
          <label>Organisation Column Header</label>
          <p class="hld-field-hint">Header for the secondary column (e.g. "Stud", "Operator").</p>
          <input type="text" name="org_label" id="hld-type-org_label" placeholder="e.g. Operator" />
        </div>
        <div class="hld-field">
          <label>Icon / Initials</label>
          <p class="hld-field-hint">Short text shown in the category nav badge (1–3 chars).</p>
          <input type="text" name="icon" id="hld-type-icon" maxlength="4" placeholder="e.g. FA" />
        </div>
        <div class="hld-field">
          <label>Tagline</label>
          <p class="hld-field-hint">Sub-heading under the directory title.</p>
          <input type="text" name="tagline" id="hld-type-tagline" placeholder="e.g. Accredited farriers" />
        </div>
        <div class="hld-field hld-field--full">
          <label>Coming-soon Description</label>
          <p class="hld-field-hint">Shown on the branded empty state before any listings exist.</p>
          <textarea name="description" id="hld-type-description" rows="3" placeholder="Describe this category…"></textarea>
        </div>
        <div class="hld-field hld-field--full">
          <label class="hld-toggle-label">
            <input type="checkbox" name="enabled" id="hld-type-enabled" value="1" checked />
            <span class="hld-toggle-text"><strong>Visible</strong> — show this category in the front-end navigation.</span>
          </label>
        </div>
        <div class="hld-field hld-field--full">
          <label class="hld-toggle-label">
            <input type="checkbox" name="supports_gait" id="hld-type-supports_gait" value="1" />
            <span class="hld-toggle-text"><strong>Gait column</strong> — show the Pacer/Trotter column &amp; filter (stallions).</span>
          </label>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:8px;">
        <button type="submit" class="hld-btn hld-btn--primary">Save Directory Type</button>
        <button type="button" class="hld-btn hld-btn--ghost" id="hld-type-reset">Reset Form</button>
      </div>
    </form>
  </div>

  <div class="hld-settings-card" style="margin-top:18px;">
    <h2 style="margin-top:0;">Using a directory type</h2>
    <div class="hld-shortcode-list">
      Display any category on a page with its slug:<br><br>
      <code>[harnesslink_directory type="stallion"]</code><br>
      <code>[harnesslink_directory type="trainer"]</code><br>
      <code>[harnesslink_directory type="agistment"]</code><br><br>
      Each type also has its own archive at <code>/directory/&lt;slug&gt;/</code>.
      After adding a new type, visit <strong>Settings → Permalinks → Save</strong> once to refresh URLs.
    </div>
  </div>

</div>

<script>
(function(){
  function $(id){ return document.getElementById(id); }
  var fields = ['slug','singular','plural','name_label','org_label','icon','tagline','description','sort'];

  function resetForm(){
    $('hld-type-form-title').textContent = 'Add Directory Type';
    $('hld-type-original_slug').value = '';
    fields.forEach(function(f){ var el = $('hld-type-'+f); if(el) el.value = (f==='sort'?'500':''); });
    $('hld-type-enabled').checked = true;
    $('hld-type-supports_gait').checked = false;
    $('hld-type-slug').readOnly = false;
  }

  document.querySelectorAll('.hld-type-edit').forEach(function(btn){
    btn.addEventListener('click', function(){
      var t = JSON.parse(this.getAttribute('data-type'));
      $('hld-type-form-title').textContent = 'Edit: ' + (t.plural || t.slug);
      $('hld-type-original_slug').value = t.slug;
      $('hld-type-slug').value = t.slug;
      $('hld-type-singular').value = t.singular || '';
      $('hld-type-plural').value = t.plural || '';
      $('hld-type-name_label').value = t.name_label || '';
      $('hld-type-org_label').value = t.org_label || '';
      $('hld-type-icon').value = t.icon || '';
      $('hld-type-tagline').value = t.tagline || '';
      $('hld-type-description').value = t.description || '';
      $('hld-type-sort').value = (t.sort != null ? t.sort : 500);
      $('hld-type-enabled').checked = !!(t.enabled == 1 || t.enabled === true);
      $('hld-type-supports_gait').checked = !!(t.supports_gait == 1 || t.supports_gait === true);
      // Built-in slugs are referenced by listings — lock the slug field.
      $('hld-type-slug').readOnly = !!(t.builtin == 1 || t.builtin === true);
      $('hld-type-form-card').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });

  $('hld-type-reset').addEventListener('click', resetForm);
  $('hld-type-add-new').addEventListener('click', function(){
    resetForm();
    $('hld-type-form-card').scrollIntoView({behavior:'smooth', block:'start'});
  });
})();
</script>
