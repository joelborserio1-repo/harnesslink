<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_Admin {

    public static function init() {
        add_action( 'admin_menu',            array( __CLASS__, 'register_menu' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
    }

    public static function register_menu() {
        add_menu_page(
            'HarnessLink Directory',
            'HarnessLink',
            'manage_options',
            'hld-dashboard',
            array( __CLASS__, 'page_stallions' ),
            'dashicons-awards',
            30
        );

        add_submenu_page(
            'hld-dashboard',
            'Stallions',
            'Stallions',
            'manage_options',
            'hld-dashboard',
            array( __CLASS__, 'page_stallions' )
        );

        /* Enquiries with new-count badge */
        $new_count  = HLD_DB::count_new_enquiries();
        $badge      = $new_count ? ' <span class="awaiting-mod count-' . $new_count . '"><span class="pending-count">' . $new_count . '</span></span>' : '';

        add_submenu_page(
            'hld-dashboard',
            'Listing Enquiries',
            'Enquiries' . $badge,
            'manage_options',
            'hld-enquiries',
            array( __CLASS__, 'page_enquiries' )
        );

        add_submenu_page(
            'hld-dashboard',
            'Directory Types',
            'Directory Types',
            'manage_options',
            'hld-types',
            array( __CLASS__, 'page_types' )
        );

        add_submenu_page(
            'hld-dashboard',
            'Import CSV',
            'Import CSV',
            'manage_options',
            'hld-import',
            array( __CLASS__, 'page_import' )
        );

        add_submenu_page(
            'hld-dashboard',
            'Settings',
            'Settings',
            'manage_options',
            'hld-settings',
            array( __CLASS__, 'page_settings' )
        );
    }

    public static function enqueue_assets( $hook ) {
        if ( strpos( $hook, 'hld-' ) === false && $hook !== 'toplevel_page_hld-dashboard' ) return;

        /* WP Media Library (for gallery picker) */
        wp_enqueue_media();

        wp_enqueue_style(
            'hld-admin',
            HLD_PLUGIN_URL . 'admin/css/hld-admin.css',
            array(),
            HLD_VERSION
        );
        wp_enqueue_script(
            'hld-admin',
            HLD_PLUGIN_URL . 'admin/js/hld-admin.js',
            array( 'jquery', 'jquery-ui-sortable' ),
            HLD_VERSION,
            true
        );
        wp_localize_script( 'hld-admin', 'HLD_Admin', array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'hld_admin_nonce' ),
            'types'    => HLD_Types::js_config(),
        ) );
    }

    /* ── Listings list page (type-aware) ── */
    public static function page_stallions() {
        $active_type = HLD_Types::resolve( $_GET['dtype'] ?? 'stallion' );
        $result = HLD_DB::get_listings( array(
            'directory_type' => $active_type,
            'search'  => sanitize_text_field( $_GET['s'] ?? '' ),
            'page'    => absint( $_GET['paged'] ?? 1 ),
            'per_page'=> 25,
        ) );
        include HLD_PLUGIN_DIR . 'admin/views/stallions.php';
    }

    /* ── Directory Types management page ── */
    public static function page_types() {
        $notice = '';

        if ( $_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer( 'hld_types' ) ) {
            $action = sanitize_text_field( $_POST['hld_type_action'] ?? '' );

            if ( $action === 'save' ) {
                $result = HLD_Types::save(
                    $_POST['slug'] ?? '',
                    array(
                        'singular'      => $_POST['singular']      ?? '',
                        'plural'        => $_POST['plural']        ?? '',
                        'name_label'    => $_POST['name_label']    ?? '',
                        'org_label'     => $_POST['org_label']     ?? '',
                        'icon'          => $_POST['icon']          ?? '',
                        'tagline'       => $_POST['tagline']       ?? '',
                        'description'   => $_POST['description']   ?? '',
                        'supports_gait' => ! empty( $_POST['supports_gait'] ),
                        'enabled'       => ! empty( $_POST['enabled'] ),
                        'sort'          => $_POST['sort']          ?? 500,
                    ),
                    $_POST['original_slug'] ?? ''
                );
                $notice = is_wp_error( $result )
                    ? array( 'error', $result->get_error_message() )
                    : array( 'success', 'Directory type saved.' );
            } elseif ( $action === 'delete' ) {
                $result = HLD_Types::delete( $_POST['slug'] ?? '' );
                $notice = is_wp_error( $result )
                    ? array( 'error', $result->get_error_message() )
                    : array( 'success', 'Directory type deleted.' );
            }
        }

        $types  = HLD_Types::get_all();
        $counts = HLD_DB::counts_by_type();
        include HLD_PLUGIN_DIR . 'admin/views/types.php';
    }

    /* ── Enquiries page ── */
    public static function page_enquiries() {
        $status = sanitize_text_field( $_GET['status'] ?? '' );
        $result = HLD_DB::get_enquiries( array(
            'status'   => $status,
            'page'     => absint( $_GET['paged'] ?? 1 ),
            'per_page' => 25,
        ) );
        include HLD_PLUGIN_DIR . 'admin/views/enquiries.php';
    }

    /* ── Import CSV page ── */
    public static function page_import() {
        include HLD_PLUGIN_DIR . 'admin/views/import.php';
    }

    /* ── Settings page ── */
    public static function page_settings() {
        if ( $_SERVER['REQUEST_METHOD'] === 'POST' && check_admin_referer( 'hld_settings' ) ) {
            if ( ( $_POST['hld_settings_section'] ?? '' ) === 'auth' ) {
                /* Member access / front-end auth settings */
                update_option( 'hld_login_page_id',    absint( $_POST['login_page_id'] ?? 0 ) );
                update_option( 'hld_register_page_id',  absint( $_POST['register_page_id'] ?? 0 ) );
                update_option( 'hld_reset_page_id',     absint( $_POST['reset_page_id'] ?? 0 ) );
                update_option( 'hld_allow_registration', empty( $_POST['allow_registration'] ) ? '0' : '1' );

                $role  = sanitize_key( $_POST['register_role'] ?? 'subscriber' );
                $roles = array_keys( get_editable_roles() );
                if ( ! in_array( $role, $roles, true ) || in_array( $role, array( 'administrator', 'editor' ), true ) ) {
                    $role = 'subscriber';
                }
                update_option( 'hld_register_role', $role );

                echo '<div class="notice notice-success"><p>Member settings saved.</p></div>';
            } else {
                update_option( 'hld_directory_page_id', absint( $_POST['directory_page_id'] ?? 0 ) );
                update_option( 'hld_accent_color',      sanitize_hex_color( $_POST['accent_color'] ?? '#0A2A66' ) );

                /* Advertise / marketing page */
                update_option( 'hld_advertise_page_id', absint( $_POST['advertise_page_id'] ?? 0 ) );
                update_option( 'hld_advertise_email',   sanitize_email( $_POST['advertise_email'] ?? '' ) );
                update_option( 'hld_advertise_phone',   sanitize_text_field( $_POST['advertise_phone'] ?? '' ) );

                echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
            }
        }
        include HLD_PLUGIN_DIR . 'admin/views/settings.php';
    }
}
