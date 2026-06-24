<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap hld-wrap">

  <div class="hld-admin-header">
    <div class="hld-admin-header__brand">
      <span class="hld-logo">HL</span>
      <div>
        <h1>Import / Export Listings via CSV</h1>
        <p>Bulk-upload listings from a CSV file, or export the current data as CSV.</p>
      </div>
    </div>
  </div>

  <!-- Export current data -->
  <div class="hld-import-card" style="margin-bottom:18px;">
    <h2>Export Current Listings</h2>
    <p class="hld-field-hint" style="margin-top:0;">Download what's currently in the database as a CSV (re-importable format). The original uploaded spreadsheet is not stored on the server — this is the way to retrieve your data.</p>
    <form method="get" action="<?= esc_url( admin_url( 'admin-post.php' ) ) ?>" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <input type="hidden" name="action" value="hld_export_csv" />
      <?php wp_nonce_field( 'hld_export_csv' ); ?>
      <select name="dtype" class="hld-search-input" style="max-width:280px;">
        <option value="">All directory types</option>
        <?php foreach ( HLD_Types::get_all() as $slug => $t ): ?>
          <option value="<?= esc_attr( $slug ) ?>" <?= $slug === 'stallion' ? 'selected' : '' ?>>
            <?= esc_html( wp_strip_all_tags( $t['plural'] ) ) ?> (<?= esc_html( $slug ) ?>)
          </option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="hld-btn hld-btn--primary">⬇ Download CSV</button>
    </form>
  </div>

  <div class="hld-import-layout">

    <!-- Upload card -->
    <div class="hld-import-card">
      <h2>Upload CSV File</h2>
      <div class="hld-field" style="margin-bottom:14px;">
        <label style="font-weight:600;display:block;margin-bottom:6px;">Import into directory type</label>
        <select id="hld-import-type" class="hld-search-input" style="width:100%;">
          <?php foreach ( HLD_Types::get_all() as $slug => $t ): ?>
            <option value="<?= esc_attr( $slug ) ?>" <?= $slug === 'stallion' ? 'selected' : '' ?>>
              <?= esc_html( wp_strip_all_tags( $t['plural'] ) ) ?> (<?= esc_html( $slug ) ?>)
            </option>
          <?php endforeach; ?>
        </select>
        <p class="hld-field-hint" style="margin-top:6px;">All rows in this CSV will be imported as the selected type.</p>
      </div>
      <div id="hld-drop-zone" class="hld-drop-zone">
        <div class="hld-drop-zone__icon">CSV</div>
        <p>Drag &amp; drop your CSV here, or <label for="hld-csv-input" class="hld-file-label">browse files</label></p>
        <input type="file" id="hld-csv-input" accept=".csv" style="display:none;" />
        <p id="hld-file-name" class="hld-file-name"></p>
      </div>
      <label class="hld-toggle-label" style="margin:12px 0 14px;display:flex;">
        <input type="checkbox" id="hld-replace-all" />
        <span class="hld-toggle-text">
          <strong>Replace all existing listings of this type</strong> — clears the selected category before importing this CSV. Other categories are not affected.
        </span>
      </label>
      <button class="hld-btn hld-btn--primary hld-btn--full" id="hld-import-btn" disabled>Import CSV</button>
      <div id="hld-import-result" class="hld-import-result" style="display:none;"></div>
    </div>

    <!-- Format guide -->
    <div class="hld-import-guide">
      <h2>CSV Column Reference</h2>
      <p>Your CSV must have a header row. Recognised column names:</p>

      <table class="hld-guide-table">
        <thead><tr><th>Column Name</th><th>Required</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><code>name</code></td><td>✓ Yes</td><td>Stallion display name</td></tr>
          <tr><td><code>stud</code> or <code>stud_name</code></td><td>—</td><td>Stud / farm name</td></tr>
          <tr><td><code>country</code></td><td>—</td><td>e.g. Australia, New Zealand</td></tr>
          <tr><td><code>region</code></td><td>—</td><td>e.g. VIC, NSW, South Island</td></tr>
          <tr><td><code>stud_master</code></td><td>—</td><td>Contact person name</td></tr>
          <tr><td><code>type</code></td><td>—</td><td>Gait: <code>Pacer</code> or <code>Trotter</code></td></tr>
          <tr><td><code>status_note</code></td><td>—</td><td>e.g. "Standing at stud"</td></tr>
          <tr><td><code>is_paying</code></td><td>—</td><td><code>1</code>, <code>yes</code>, or <code>true</code> for paid</td></tr>
          <tr><td><code>is_featured</code> or <code>Featured Stud</code></td><td>—</td><td><code>1</code>, <code>yes</code>, or <code>true</code> for premium featured placement</td></tr>
          <tr><td><code>phone</code></td><td>—</td><td>Contact phone</td></tr>
          <tr><td><code>email</code></td><td>—</td><td>Contact email</td></tr>
          <tr><td><code>website</code></td><td>—</td><td>Full URL including https://</td></tr>
          <tr><td><code>stallion_page</code> or <code>Stallion Page</code></td><td>—</td><td>Direct stallion page URL</td></tr>
          <tr><td><code>stud_website</code> or <code>Stud Website</code></td><td>—</td><td>Stud website URL</td></tr>
          <tr><td><code>profile_picture</code> or <code>Profile Picture</code></td><td>—</td><td>Profile image URL</td></tr>
          <tr><td><code>contact_au</code> or <code>AU Contact</code></td><td>—</td><td>Australia contact block</td></tr>
          <tr><td><code>contact_us</code> or <code>US Contact</code></td><td>—</td><td>United States contact block</td></tr>
          <tr><td><code>contact_nz</code> or <code>NZ Contact</code></td><td>—</td><td>New Zealand contact block</td></tr>
          <tr><td><code>contact_fr</code> or <code>FR Contact</code></td><td>—</td><td>France contact block</td></tr>
          <tr><td><code>contact_other</code> or <code>Other Contact</code></td><td>—</td><td>Fallback contact block</td></tr>
          <tr><td><code>address</code></td><td>—</td><td>Postal address</td></tr>
          <tr><td><code>bio</code></td><td>—</td><td>Profile bio text</td></tr>
          <tr><td><code>race_record</code></td><td>—</td><td>e.g. 1:46.4</td></tr>
          <tr><td><code>progeny</code></td><td>—</td><td>Notable progeny text</td></tr>
        </tbody>
      </table>

      <a href="#" id="hld-download-template" class="hld-btn hld-btn--secondary" style="margin-top:16px;">
        ⬇ Download Sample CSV
      </a>
    </div>

  </div>
</div>

<script>
/* CSV sample download */
document.getElementById('hld-download-template').addEventListener('click', function(e){
  e.preventDefault();
  const headers = 'Stallion,Stud,Country,Region,Stud Master,Gait,Status Note,Paid,Featured Stud,Phone,Email,Stallion Page,Stud Website,Profile Picture,AU Contact,NZ Contact,US Contact,FR Contact,Other Contact,Bio,Race Record,Progeny';
  const sample  = 'Always B Miki,Alabar Bloodstock,Australia,VIC,Alan Galloway,Pacer,Standing at stud,yes,yes,+61 3 5555 1234,info@alabar.com.au,https://alabar.com.au/stallions/always-b-miki/,https://alabar.com.au/,https://example.com/image.jpg,"Alabar Bloodstock\n+61 3 5555 1234\ninfo@alabar.com.au",,,,,"Champion sire biography...",1:46.4,"Notable progeny here"';
  const blob = new Blob([headers + '\n' + sample], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'harnesslink-stallion-import-sample.csv';
  a.click();
});
</script>
