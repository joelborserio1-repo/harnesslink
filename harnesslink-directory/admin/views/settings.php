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
          <label>Advertise / Marketing Page</label>
          <p class="hld-field-hint">Select the WordPress page where you've placed the <code>[harnesslink_advertise]</code> shortcode.</p>
          <?php wp_dropdown_pages( array(
            'name'              => 'advertise_page_id',
            'selected'          => get_option( 'hld_advertise_page_id', 0 ),
            'show_option_none'  => '— Select page —',
            'option_none_value' => 0,
          ) ); ?>
        </div>

        <div class="hld-field">
          <label>Advertise Contact / Leads Email</label>
          <p class="hld-field-hint">Contact form submissions from the advertise page are emailed here, and this address is shown as the direct contact on the page. Falls back to the site admin email if blank.</p>
          <input type="email" name="advertise_email" class="regular-text" placeholder="sales@harnesslink.com" value="<?= esc_attr( get_option( 'hld_advertise_email', '' ) ) ?>" />
        </div>

        <div class="hld-field hld-field--full">
          <label>Hero Background Image</label>
          <p class="hld-field-hint">Optional photo behind the top banner. Upload it under <strong>Media → Add New</strong>, copy its <strong>File URL</strong>, and paste it here. A navy overlay is applied automatically so the headline stays readable. Leave blank for the plain navy gradient.</p>
          <input type="url" name="advertise_hero" class="regular-text" style="width:100%;max-width:560px;" placeholder="https://harnesslink.com/wp-content/uploads/2026/06/race.jpg" value="<?= esc_attr( get_option( 'hld_advertise_hero', '' ) ) ?>" />
        </div>

        <div class="hld-field">
          <label>Advertise Contact Phone</label>
          <p class="hld-field-hint">Optional. Shown as a “call us” link on the advertise page.</p>
          <input type="text" name="advertise_phone" class="regular-text" placeholder="+61 3 5555 1234" value="<?= esc_attr( get_option( 'hld_advertise_phone', '' ) ) ?>" />
        </div>

        <div class="hld-field hld-field--full">
          <label>Shortcodes Reference</label>
          <div class="hld-shortcode-list">
            <code>[harnesslink_directory]</code> — Full directory hub with category navigation, search and listings (opens on Stallions).<br><br>
            <code>[harnesslink_directory type="trainer"]</code> — Opens the directory on a specific category. Any registered slug works (<code>stallion</code>, <code>trainer</code>, <code>driver</code>, <code>agistment</code>, <code>transport</code>, <code>vet</code>, …).<br><br>
            <code>[harnesslink_directory nav="false"]</code> — Hide the category navigation bar.<br><br>
            <code>[harnesslink_stallion id="42"]</code> — Embeds a single listing profile card on any page.<br><br>
            <code>[harnesslink_advertise]</code> — Marketing landing page with packages and a contact form (leads emailed to the address above). Optional overrides: <code>email=""</code>, <code>phone=""</code>.<br><br>
            Manage categories under <strong>HarnessLink → Directory Types</strong>. Each type also has an archive at <code>/directory/&lt;slug&gt;/</code>.
          </div>
        </div>
      </div>

      <button type="submit" class="hld-btn hld-btn--primary">Save Settings</button>
    </form>
  </div>

  <!-- ── Member Access / Front-end Auth ── -->
  <div class="hld-settings-card" style="margin-top:18px;">
    <h2 style="margin-top:0;">Member Access (Front-end Login)</h2>
    <p class="hld-field-hint" style="margin-top:0;">Built on the WordPress core user system — no third-party membership plugin required. Create three pages (Login, Register, Reset Password), add the shortcodes below, then select them here.</p>
    <form method="post">
      <?php wp_nonce_field( 'hld_settings' ); ?>
      <input type="hidden" name="hld_settings_section" value="auth" />

      <div class="hld-form-grid">
        <div class="hld-field">
          <label>Login Page <code>[harnesslink_login]</code></label>
          <?php wp_dropdown_pages( array(
            'name'              => 'login_page_id',
            'selected'          => get_option( 'hld_login_page_id', 0 ),
            'show_option_none'  => '— Use default wp-login —',
            'option_none_value' => 0,
          ) ); ?>
        </div>
        <div class="hld-field">
          <label>Register Page <code>[harnesslink_register]</code></label>
          <?php wp_dropdown_pages( array(
            'name'              => 'register_page_id',
            'selected'          => get_option( 'hld_register_page_id', 0 ),
            'show_option_none'  => '— None —',
            'option_none_value' => 0,
          ) ); ?>
        </div>
        <div class="hld-field">
          <label>Reset Password Page <code>[harnesslink_reset]</code></label>
          <?php wp_dropdown_pages( array(
            'name'              => 'reset_page_id',
            'selected'          => get_option( 'hld_reset_page_id', 0 ),
            'show_option_none'  => '— Use default ──',
            'option_none_value' => 0,
          ) ); ?>
        </div>
        <div class="hld-field">
          <label>New Member Role</label>
          <p class="hld-field-hint">Role assigned to self-registered members.</p>
          <select name="register_role">
            <?php wp_dropdown_roles( get_option( 'hld_register_role', 'subscriber' ) ); ?>
          </select>
        </div>
        <div class="hld-field hld-field--full">
          <label class="hld-toggle-label">
            <input type="checkbox" name="allow_registration" value="1" <?= checked( get_option( 'hld_allow_registration', '1' ), '1', false ) ?> />
            <span class="hld-toggle-text"><strong>Allow self-registration</strong> — visitors can create their own member account from the Register page.</span>
          </label>
        </div>
        <div class="hld-field hld-field--full">
          <div class="hld-shortcode-list">
            <strong>Member shortcodes:</strong><br>
            <code>[harnesslink_login]</code> · <code>[harnesslink_register]</code> · <code>[harnesslink_reset]</code> · <code>[harnesslink_account]</code><br><br>
            Non-admin members are kept out of <code>wp-admin</code> and the admin bar is hidden for them. Any logged-in user can view profiles &amp; contact details.
          </div>
        </div>
      </div>

      <button type="submit" class="hld-btn hld-btn--primary">Save Member Settings</button>
    </form>
  </div>
</div>
