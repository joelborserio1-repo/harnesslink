<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * HLD_Auth
 *
 * Self-contained front-end authentication for the HarnessLink Directory,
 * built entirely on WordPress core (wp_signon, wp_create_user, the core
 * password-reset key functions). No third-party membership plugin required.
 *
 * Provides branded shortcodes:
 *   [harnesslink_login]     — login form (+ links to register / reset)
 *   [harnesslink_register]  — self-registration form
 *   [harnesslink_reset]     — lost-password request + reset-with-key form
 *   [harnesslink_account]   — tiny "logged in as … / log out" panel
 *
 * Also:
 *   - Rewires hld_login_url() to the configured front-end login page.
 *   - Keeps non-admin members out of wp-admin and hides the admin bar.
 *
 * Settings (saved on the plugin Settings screen):
 *   hld_login_page_id, hld_register_page_id, hld_reset_page_id
 *   hld_allow_registration (1/0), hld_register_role
 */
class HLD_Auth {

    public static function init() {
        add_shortcode( 'harnesslink_login',    array( __CLASS__, 'login_form' ) );
        add_shortcode( 'harnesslink_register', array( __CLASS__, 'register_form' ) );
        add_shortcode( 'harnesslink_reset',    array( __CLASS__, 'reset_form' ) );
        add_shortcode( 'harnesslink_account',  array( __CLASS__, 'account_box' ) );

        // Process form submissions before any output (cookies + redirects).
        add_action( 'template_redirect', array( __CLASS__, 'handle_forms' ) );

        // Keep non-admins out of wp-admin and hide the toolbar for them.
        add_action( 'admin_init',       array( __CLASS__, 'block_admin' ) );
        add_action( 'after_setup_theme', array( __CLASS__, 'maybe_hide_admin_bar' ) );
    }

    /* ──────────────────────────────────────────────
       URL HELPERS
    ────────────────────────────────────────────── */

    public static function login_url( $redirect_to = '' ) {
        $page_id = (int) get_option( 'hld_login_page_id', 0 );
        if ( $page_id && get_post_status( $page_id ) === 'publish' ) {
            $url = get_permalink( $page_id );
            if ( $redirect_to ) {
                $url = add_query_arg( 'redirect_to', rawurlencode( $redirect_to ), $url );
            }
            return $url;
        }
        // No page configured — fall back to core login.
        return wp_login_url( $redirect_to );
    }

    public static function register_url() {
        $page_id = (int) get_option( 'hld_register_page_id', 0 );
        return ( $page_id && get_post_status( $page_id ) === 'publish' )
            ? get_permalink( $page_id )
            : wp_registration_url();
    }

    public static function reset_url() {
        $page_id = (int) get_option( 'hld_reset_page_id', 0 );
        return ( $page_id && get_post_status( $page_id ) === 'publish' )
            ? get_permalink( $page_id )
            : wp_lostpassword_url();
    }

    public static function registration_enabled() {
        return get_option( 'hld_allow_registration', '1' ) === '1';
    }

    private static function default_role() {
        $role = sanitize_key( get_option( 'hld_register_role', 'subscriber' ) );
        $roles = array_keys( get_editable_roles() );
        // Never allow self-registration into a privileged role.
        if ( ! in_array( $role, $roles, true ) || in_array( $role, array( 'administrator', 'editor' ), true ) ) {
            $role = 'subscriber';
        }
        return $role;
    }

    private static function safe_redirect_target( $raw ) {
        $raw = $raw ? wp_unslash( $raw ) : '';
        $target = $raw ? wp_validate_redirect( $raw, home_url( '/directory/' ) ) : home_url( '/directory/' );
        return $target;
    }

    /* ──────────────────────────────────────────────
       HONEYPOT (anti-bot for public forms)
    ────────────────────────────────────────────── */

    /** Minimum seconds a genuine human takes to complete the form. */
    const HONEYPOT_MIN_SECONDS = 3;

    /**
     * Render the hidden honeypot field + a timestamp token.
     * The decoy field is hidden from humans (and from assistive tech) but
     * visible to naive bots that fill every input.
     *
     * @param string $ts_name name of the timestamp hidden input
     */
    private static function honeypot_fields( $ts_name ) {
        ob_start(); ?>
        <div class="hld-hp" aria-hidden="true" style="position:absolute!important;left:-9999px!important;top:auto;width:1px;height:1px;overflow:hidden;">
          <label for="hld_website">Website (leave this field empty)</label>
          <input type="text" name="hld_website" id="hld_website" tabindex="-1" autocomplete="off" value="" />
        </div>
        <input type="hidden" name="<?= esc_attr( $ts_name ) ?>" value="<?= esc_attr( time() ) ?>" />
        <?php
        return ob_get_clean();
    }

    /**
     * Returns false when the submission looks like a bot:
     *   - the decoy "hld_website" field is non-empty, OR
     *   - the form was submitted faster than a human could (timing trap).
     *
     * @param string $ts_name name of the timestamp field for this form
     */
    private static function passes_honeypot( $ts_name ) {
        // Decoy must be empty.
        if ( ! empty( $_POST['hld_website'] ) ) {
            return false;
        }
        // Timing trap (only enforce when a sane timestamp is present).
        $ts = isset( $_POST[ $ts_name ] ) ? absint( $_POST[ $ts_name ] ) : 0;
        if ( $ts > 0 && ( time() - $ts ) < self::HONEYPOT_MIN_SECONDS ) {
            return false;
        }
        return true;
    }

    /* ──────────────────────────────────────────────
       FORM PROCESSING  (runs on template_redirect)
    ────────────────────────────────────────────── */

    public static function handle_forms() {
        if ( $_SERVER['REQUEST_METHOD'] !== 'POST' ) return;
        $action = isset( $_POST['hld_auth_action'] ) ? sanitize_key( $_POST['hld_auth_action'] ) : '';
        if ( ! $action ) return;

        switch ( $action ) {
            case 'login':    self::do_login();    break;
            case 'register': self::do_register(); break;
            case 'lostpass': self::do_lostpass(); break;
            case 'resetpass':self::do_resetpass();break;
        }
    }

    private static function redirect_with( $url, $args ) {
        wp_safe_redirect( add_query_arg( $args, $url ) );
        exit;
    }

    /* ── Login ── */
    private static function do_login() {
        if ( ! isset( $_POST['hld_login_nonce'] ) || ! wp_verify_nonce( $_POST['hld_login_nonce'], 'hld_login' ) ) {
            self::redirect_with( self::login_url(), array( 'hld_err' => 'nonce' ) );
        }

        // Honeypot: a filled decoy field means a bot — fail as a normal
        // "wrong credentials" so it gets no useful signal. No timing trap on
        // login (password managers can autofill near-instantly).
        if ( ! empty( $_POST['hld_website'] ) ) {
            self::redirect_with( self::login_url(), array( 'hld_err' => 'login' ) );
        }

        $creds = array(
            'user_login'    => sanitize_user( wp_unslash( $_POST['log'] ?? '' ) ),
            'user_password' => (string) ( $_POST['pwd'] ?? '' ),
            'remember'      => ! empty( $_POST['rememberme'] ),
        );
        $redirect = self::safe_redirect_target( $_POST['redirect_to'] ?? '' );

        $user = wp_signon( $creds, is_ssl() );
        if ( is_wp_error( $user ) ) {
            self::redirect_with( self::login_url( $redirect ), array( 'hld_err' => 'login' ) );
        }
        wp_safe_redirect( $redirect );
        exit;
    }

    /* ── Self-registration ── */
    private static function do_register() {
        $login_page = self::register_url();

        if ( ! self::registration_enabled() ) {
            self::redirect_with( $login_page, array( 'hld_err' => 'reg_closed' ) );
        }
        if ( ! isset( $_POST['hld_register_nonce'] ) || ! wp_verify_nonce( $_POST['hld_register_nonce'], 'hld_register' ) ) {
            self::redirect_with( $login_page, array( 'hld_err' => 'nonce' ) );
        }

        /* ── Honeypot + timing trap ──
           Real users leave the hidden "hld_website" field empty and take a
           moment to fill the form. Bots typically fill every field and submit
           instantly. On a hit we silently drop the request and show a neutral
           "check your email" notice — giving the bot no signal it was caught. */
        if ( ! self::passes_honeypot( 'hld_register_ts' ) ) {
            self::redirect_with( self::login_url(), array( 'hld_msg' => 'reg_review' ) );
        }

        $email = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
        $user_login = sanitize_user( wp_unslash( $_POST['user_login'] ?? '' ), true );
        if ( ! $user_login ) {
            // Derive a username from the email local-part if none supplied.
            $user_login = sanitize_user( current( explode( '@', $email ) ), true );
        }
        $pass1 = (string) ( $_POST['pass1'] ?? '' );
        $pass2 = (string) ( $_POST['pass2'] ?? '' );

        if ( ! is_email( $email ) )                self::redirect_with( $login_page, array( 'hld_err' => 'reg_email' ) );
        if ( email_exists( $email ) )              self::redirect_with( $login_page, array( 'hld_err' => 'reg_email_used' ) );
        if ( ! $user_login || username_exists( $user_login ) ) self::redirect_with( $login_page, array( 'hld_err' => 'reg_user' ) );
        if ( strlen( $pass1 ) < 8 )                self::redirect_with( $login_page, array( 'hld_err' => 'reg_pwd_short' ) );
        if ( $pass1 !== $pass2 )                   self::redirect_with( $login_page, array( 'hld_err' => 'reg_pwd_match' ) );

        $user_id = wp_insert_user( array(
            'user_login'   => $user_login,
            'user_email'   => $email,
            'user_pass'    => $pass1,
            'first_name'   => sanitize_text_field( wp_unslash( $_POST['first_name'] ?? '' ) ),
            'role'         => self::default_role(),
        ) );

        if ( is_wp_error( $user_id ) ) {
            self::redirect_with( $login_page, array( 'hld_err' => 'reg_fail' ) );
        }

        /* Notify admin (and the new user) using core helper. */
        wp_new_user_notification( $user_id, null, 'admin' );

        /* Log the new member straight in. */
        wp_set_current_user( $user_id );
        wp_set_auth_cookie( $user_id, false, is_ssl() );

        wp_safe_redirect( self::safe_redirect_target( $_POST['redirect_to'] ?? '' ) );
        exit;
    }

    /* ── Lost password: send reset link ── */
    private static function do_lostpass() {
        $reset_page = self::reset_url();

        if ( ! isset( $_POST['hld_lostpass_nonce'] ) || ! wp_verify_nonce( $_POST['hld_lostpass_nonce'], 'hld_lostpass' ) ) {
            self::redirect_with( $reset_page, array( 'hld_err' => 'nonce' ) );
        }

        // Honeypot: silently report the same neutral "sent" notice for bots.
        if ( ! self::passes_honeypot( 'hld_lostpass_ts' ) ) {
            self::redirect_with( $reset_page, array( 'hld_msg' => 'lost_sent' ) );
        }

        $login = sanitize_text_field( wp_unslash( $_POST['user_login'] ?? '' ) );
        $user  = is_email( $login ) ? get_user_by( 'email', $login ) : get_user_by( 'login', $login );

        // Always report success — don't disclose whether an account exists.
        if ( ! $user ) {
            self::redirect_with( $reset_page, array( 'hld_msg' => 'lost_sent' ) );
        }

        $key = get_password_reset_key( $user );
        if ( is_wp_error( $key ) ) {
            self::redirect_with( $reset_page, array( 'hld_msg' => 'lost_sent' ) );
        }

        $reset_link = add_query_arg( array(
            'hld_key'   => rawurlencode( $key ),
            'hld_login' => rawurlencode( $user->user_login ),
        ), $reset_page );

        $subject = sprintf( '[%s] Password reset', wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ) );
        $body  = "Someone requested a password reset for your HarnessLink account.\n\n";
        $body .= "If this was you, set a new password here:\n" . esc_url_raw( $reset_link ) . "\n\n";
        $body .= "If you didn't request this, you can safely ignore this email.";
        wp_mail( $user->user_email, $subject, $body );

        self::redirect_with( $reset_page, array( 'hld_msg' => 'lost_sent' ) );
    }

    /* ── Lost password: set the new password ── */
    private static function do_resetpass() {
        $reset_page = self::reset_url();

        if ( ! isset( $_POST['hld_resetpass_nonce'] ) || ! wp_verify_nonce( $_POST['hld_resetpass_nonce'], 'hld_resetpass' ) ) {
            self::redirect_with( $reset_page, array( 'hld_err' => 'nonce' ) );
        }

        $login = sanitize_text_field( wp_unslash( $_POST['hld_login'] ?? '' ) );
        $key   = (string) wp_unslash( $_POST['hld_key'] ?? '' );
        $pass1 = (string) ( $_POST['pass1'] ?? '' );
        $pass2 = (string) ( $_POST['pass2'] ?? '' );

        $user = check_password_reset_key( $key, $login );
        if ( is_wp_error( $user ) ) {
            self::redirect_with( $reset_page, array( 'hld_err' => 'reset_key' ) );
        }
        if ( strlen( $pass1 ) < 8 ) self::redirect_with( add_query_arg( array( 'hld_key' => rawurlencode( $key ), 'hld_login' => rawurlencode( $login ) ), $reset_page ), array( 'hld_err' => 'reg_pwd_short' ) );
        if ( $pass1 !== $pass2 )    self::redirect_with( add_query_arg( array( 'hld_key' => rawurlencode( $key ), 'hld_login' => rawurlencode( $login ) ), $reset_page ), array( 'hld_err' => 'reg_pwd_match' ) );

        reset_password( $user, $pass1 );
        self::redirect_with( self::login_url(), array( 'hld_msg' => 'reset_done' ) );
    }

    /* ──────────────────────────────────────────────
       ADMIN LOCKOUT
    ────────────────────────────────────────────── */

    public static function block_admin() {
        if ( wp_doing_ajax() ) return;                 // AJAX must keep working
        if ( current_user_can( 'manage_options' ) ) return;
        // Allow access to admin-post.php if ever needed; block the dashboard.
        wp_safe_redirect( home_url( '/directory/' ) );
        exit;
    }

    public static function maybe_hide_admin_bar() {
        if ( is_user_logged_in() && ! current_user_can( 'manage_options' ) ) {
            show_admin_bar( false );
        }
    }

    /* ──────────────────────────────────────────────
       MESSAGES
    ────────────────────────────────────────────── */

    private static function messages() {
        return array(
            'errors' => array(
                'nonce'          => 'Your session expired. Please try again.',
                'login'          => 'Incorrect username/email or password.',
                'reg_closed'     => 'Registration is currently closed.',
                'reg_email'      => 'Please enter a valid email address.',
                'reg_email_used' => 'An account with that email already exists.',
                'reg_user'       => 'That username is taken or invalid. Try another.',
                'reg_pwd_short'  => 'Password must be at least 8 characters.',
                'reg_pwd_match'  => 'The two passwords do not match.',
                'reg_fail'       => 'Could not create your account. Please try again.',
                'reset_key'      => 'This reset link is invalid or has expired. Please request a new one.',
            ),
            'notices' => array(
                'lost_sent'  => 'If an account exists for that email, a reset link is on its way.',
                'reset_done' => 'Your password has been reset. You can now log in.',
                'loggedout'  => 'You have been logged out.',
                'reg_review' => 'Thanks! Your details have been received and are being reviewed.',
            ),
        );
    }

    private static function current_error() {
        $code = isset( $_GET['hld_err'] ) ? sanitize_key( $_GET['hld_err'] ) : '';
        $m = self::messages();
        return $code && isset( $m['errors'][ $code ] ) ? $m['errors'][ $code ] : '';
    }

    private static function current_notice() {
        $code = isset( $_GET['hld_msg'] ) ? sanitize_key( $_GET['hld_msg'] ) : '';
        $m = self::messages();
        return $code && isset( $m['notices'][ $code ] ) ? $m['notices'][ $code ] : '';
    }

    private static function alerts_html() {
        $out = '';
        if ( $err = self::current_error() ) {
            $out .= '<div class="hld-auth-alert hld-auth-alert--error">' . esc_html( $err ) . '</div>';
        }
        if ( $msg = self::current_notice() ) {
            $out .= '<div class="hld-auth-alert hld-auth-alert--success">' . esc_html( $msg ) . '</div>';
        }
        return $out;
    }

    /* ──────────────────────────────────────────────
       SHORTCODE RENDERERS
    ────────────────────────────────────────────── */

    public static function login_form( $atts ) {
        if ( is_user_logged_in() ) {
            return self::logged_in_panel();
        }
        $redirect = self::safe_redirect_target( $_GET['redirect_to'] ?? '' );
        ob_start(); ?>
        <div class="hl-directory harnesslink-directory hld-auth-wrap">
          <div class="hld-auth-card">
            <h2 class="hld-auth-title">Log in to HarnessLink</h2>
            <p class="hld-auth-sub">Access full profiles and contact details across the directory.</p>
            <?= self::alerts_html() ?>
            <form method="post" class="hld-auth-form">
              <?php wp_nonce_field( 'hld_login', 'hld_login_nonce' ); ?>
              <input type="hidden" name="hld_auth_action" value="login" />
              <input type="hidden" name="redirect_to" value="<?= esc_attr( $redirect ) ?>" />
              <?= self::honeypot_fields( 'hld_login_ts' ) ?>
              <div class="hld-auth-field">
                <label for="hld-log">Username or Email</label>
                <input type="text" name="log" id="hld-log" autocomplete="username" required />
              </div>
              <div class="hld-auth-field">
                <label for="hld-pwd">Password</label>
                <input type="password" name="pwd" id="hld-pwd" autocomplete="current-password" required />
              </div>
              <label class="hld-auth-remember">
                <input type="checkbox" name="rememberme" value="forever" /> Remember me
              </label>
              <button type="submit" class="hld-auth-btn">Log In</button>
            </form>
            <div class="hld-auth-links">
              <?php if ( self::registration_enabled() ): ?>
                <a href="<?= esc_url( self::register_url() ) ?>">Create an account</a>
                <span class="hld-auth-sep">·</span>
              <?php endif; ?>
              <a href="<?= esc_url( self::reset_url() ) ?>">Forgot password?</a>
            </div>
          </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public static function register_form( $atts ) {
        if ( is_user_logged_in() ) {
            return self::logged_in_panel();
        }
        if ( ! self::registration_enabled() ) {
            return '<div class="hl-directory harnesslink-directory hld-auth-wrap"><div class="hld-auth-card">'
                 . '<h2 class="hld-auth-title">Registration closed</h2>'
                 . '<p class="hld-auth-sub">New accounts are not open right now. Please <a href="' . esc_url( self::login_url() ) . '">log in</a> if you already have one.</p>'
                 . '</div></div>';
        }
        $redirect = self::safe_redirect_target( $_GET['redirect_to'] ?? '' );
        ob_start(); ?>
        <div class="hl-directory harnesslink-directory hld-auth-wrap">
          <div class="hld-auth-card">
            <h2 class="hld-auth-title">Create your HarnessLink account</h2>
            <p class="hld-auth-sub">Free to join — unlock profiles and contact details.</p>
            <?= self::alerts_html() ?>
            <form method="post" class="hld-auth-form">
              <?php wp_nonce_field( 'hld_register', 'hld_register_nonce' ); ?>
              <input type="hidden" name="hld_auth_action" value="register" />
              <input type="hidden" name="redirect_to" value="<?= esc_attr( $redirect ) ?>" />
              <?= self::honeypot_fields( 'hld_register_ts' ) ?>
              <div class="hld-auth-field">
                <label for="hld-reg-first">First Name</label>
                <input type="text" name="first_name" id="hld-reg-first" autocomplete="given-name" />
              </div>
              <div class="hld-auth-field">
                <label for="hld-reg-email">Email <span class="req">*</span></label>
                <input type="email" name="email" id="hld-reg-email" autocomplete="email" required />
              </div>
              <div class="hld-auth-field">
                <label for="hld-reg-user">Username</label>
                <input type="text" name="user_login" id="hld-reg-user" autocomplete="username" placeholder="Optional — we'll create one from your email" />
              </div>
              <div class="hld-auth-field">
                <label for="hld-reg-p1">Password <span class="req">*</span></label>
                <input type="password" name="pass1" id="hld-reg-p1" autocomplete="new-password" required />
              </div>
              <div class="hld-auth-field">
                <label for="hld-reg-p2">Confirm Password <span class="req">*</span></label>
                <input type="password" name="pass2" id="hld-reg-p2" autocomplete="new-password" required />
              </div>
              <button type="submit" class="hld-auth-btn">Create Account</button>
            </form>
            <div class="hld-auth-links">
              <a href="<?= esc_url( self::login_url() ) ?>">Already have an account? Log in</a>
            </div>
          </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public static function reset_form( $atts ) {
        // Two modes: with a valid key in the URL → set new password; otherwise → request link.
        $key   = isset( $_GET['hld_key'] )   ? (string) wp_unslash( $_GET['hld_key'] )   : '';
        $login = isset( $_GET['hld_login'] ) ? sanitize_text_field( wp_unslash( $_GET['hld_login'] ) ) : '';
        $valid = false;
        if ( $key && $login ) {
            $check = check_password_reset_key( $key, $login );
            $valid = ! is_wp_error( $check );
        }

        ob_start(); ?>
        <div class="hl-directory harnesslink-directory hld-auth-wrap">
          <div class="hld-auth-card">
          <?php if ( $valid ): ?>
            <h2 class="hld-auth-title">Choose a new password</h2>
            <?= self::alerts_html() ?>
            <form method="post" class="hld-auth-form">
              <?php wp_nonce_field( 'hld_resetpass', 'hld_resetpass_nonce' ); ?>
              <input type="hidden" name="hld_auth_action" value="resetpass" />
              <input type="hidden" name="hld_key" value="<?= esc_attr( $key ) ?>" />
              <input type="hidden" name="hld_login" value="<?= esc_attr( $login ) ?>" />
              <div class="hld-auth-field">
                <label for="hld-rp1">New Password <span class="req">*</span></label>
                <input type="password" name="pass1" id="hld-rp1" autocomplete="new-password" required />
              </div>
              <div class="hld-auth-field">
                <label for="hld-rp2">Confirm Password <span class="req">*</span></label>
                <input type="password" name="pass2" id="hld-rp2" autocomplete="new-password" required />
              </div>
              <button type="submit" class="hld-auth-btn">Set New Password</button>
            </form>
          <?php else: ?>
            <h2 class="hld-auth-title">Reset your password</h2>
            <p class="hld-auth-sub">Enter your email or username and we'll send you a reset link.</p>
            <?= self::alerts_html() ?>
            <form method="post" class="hld-auth-form">
              <?php wp_nonce_field( 'hld_lostpass', 'hld_lostpass_nonce' ); ?>
              <input type="hidden" name="hld_auth_action" value="lostpass" />
              <?= self::honeypot_fields( 'hld_lostpass_ts' ) ?>
              <div class="hld-auth-field">
                <label for="hld-lost">Email or Username</label>
                <input type="text" name="user_login" id="hld-lost" autocomplete="username" required />
              </div>
              <button type="submit" class="hld-auth-btn">Send Reset Link</button>
            </form>
          <?php endif; ?>
            <div class="hld-auth-links">
              <a href="<?= esc_url( self::login_url() ) ?>">Back to log in</a>
            </div>
          </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public static function account_box( $atts ) {
        if ( ! is_user_logged_in() ) {
            return '<div class="hl-directory harnesslink-directory hld-auth-inline">'
                 . '<a class="hld-dir-link" href="' . esc_url( self::login_url() ) . '">Log in</a></div>';
        }
        return self::logged_in_panel();
    }

    private static function logged_in_panel() {
        $u = wp_get_current_user();
        $name = $u->first_name ?: $u->display_name;
        ob_start(); ?>
        <div class="hl-directory harnesslink-directory hld-auth-wrap">
          <div class="hld-auth-card hld-auth-card--compact">
            <p class="hld-auth-sub">Logged in as <strong><?= esc_html( $name ) ?></strong>.</p>
            <div class="hld-auth-links">
              <a class="hld-auth-btn hld-auth-btn--ghost" href="<?= esc_url( home_url( '/directory/' ) ) ?>">Browse Directory</a>
              <a class="hld-auth-btn" href="<?= esc_url( wp_logout_url( home_url( '/directory/' ) ) ) ?>">Log Out</a>
            </div>
          </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
