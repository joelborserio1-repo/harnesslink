<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap hld-wrap">

  <div class="hld-admin-header">
    <div class="hld-admin-header__brand">
      <span class="hld-logo">HL</span>
      <div>
        <h1>Settings</h1>
        <p>Configure HarnessLink Directory plugin options.</p>
      </div>
    </div>
  </div>

  <div class="hld-settings-card">
    <form method="post">
      <?php wp_nonce_field( 'hld_settings' ); ?>

      <div class="hld-form-grid">
        <div class="hld-field hld-field--full">
          <label>Directory Page</label>
          <p class="hld-field-hint">Select the WordPress page where you've placed the <code>[harnesslink_directory]</code> shortcode.</p>
          <?php wp_dropdown_pages( array(
            'name'              => 'directory_page_id',
            'selected'          => get_option( 'hld_directory_page_id', 0 ),
            'show_option_none'  => '— Select page —',
            'option_none_value' => 0,
          ) ); ?>
        </div>

        <div class="hld-field">
          <label>Accent Colour</label>
          <p class="hld-field-hint">Used for pills, active states and links on the public directory.</p>
          <input type="color" name="accent_color" value="<?= esc_attr( get_option( 'hld_accent_color', '#0A2A66' ) ) ?>" />
        </div>

        <div class="hld-field hld-field--full">
          <label>Shortcodes Reference</label>
          <div class="hld-shortcode-list">
            <code>[harnesslink_directory]</code> — Full directory hub with category navigation, search and listings (opens on Stallions).<br><br>
            <code>[harnesslink_directory type="trainer"]</code> — Opens the directory on a specific category. Any registered slug works (<code>stallion</code>, <code>trainer</code>, <code>driver</code>, <code>agistment</code>, <code>transport</code>, <code>vet</code>, …).<br><br>
            <code>[harnesslink_directory nav="false"]</code> — Hide the category navigation bar.<br><br>
            <code>[harnesslink_stallion id="42"]</code> — Embeds a single listing profile card on any page.<br><br>
            Manage categories under <strong>HarnessLink → Directory Types</strong>. Each type also has an archive at <code>/directory/&lt;slug&gt;/</code>.
          </div>
        </div>
      </div>

      <button type="submit" class="hld-btn hld-btn--primary">Save Settings</button>
    </form>
  </div>
</div>
