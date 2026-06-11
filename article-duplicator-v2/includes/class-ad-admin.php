<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_Admin {

    public function __construct() {
        add_action( 'admin_menu',            [ $this, 'register_menus' ] );
        add_action( 'admin_init',            [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
    }

    /* =========================================================
       MENUS
    ========================================================= */

    public function register_menus() {
        add_menu_page(
            __( 'Article Duplicator', 'article-duplicator' ),
            __( 'Article Duplicator', 'article-duplicator' ),
            'manage_options',
            'article-duplicator',
            [ $this, 'page_dashboard' ],
            'dashicons-migrate',
            30
        );

        add_submenu_page(
            'article-duplicator',
            __( 'Dashboard', 'article-duplicator' ),
            __( 'Dashboard', 'article-duplicator' ),
            'manage_options',
            'article-duplicator',
            [ $this, 'page_dashboard' ]
        );

        add_submenu_page(
            'article-duplicator',
            __( 'Import Articles', 'article-duplicator' ),
            __( 'Import Articles', 'article-duplicator' ),
            'manage_options',
            'artdup-import',
            [ $this, 'page_import' ]
        );

        add_submenu_page(
            'article-duplicator',
            __( 'Settings', 'article-duplicator' ),
            __( 'Settings', 'article-duplicator' ),
            'manage_options',
            'artdup-settings',
            [ $this, 'page_settings' ]
        );

        add_submenu_page(
            'article-duplicator',
            __( 'Import Log', 'article-duplicator' ),
            __( 'Import Log', 'article-duplicator' ),
            'manage_options',
            'artdup-log',
            [ $this, 'page_log' ]
        );

        add_submenu_page(
            'article-duplicator',
            __( 'Scraped Articles', 'article-duplicator' ),
            __( 'Scraped Articles', 'article-duplicator' ),
            'manage_options',
            'edit.php?post_type=ad_article'
        );
    }

    /* =========================================================
       SETTINGS REGISTRATION
    ========================================================= */

    public function register_settings() {
        $options = [
            'ad_source_url', 'ad_source_slug', 'ad_post_status', 'ad_post_type',
            'ad_default_category', 'ad_default_author', 'ad_import_images', 'ad_import_featured',
            'ad_duplicate_check', 'ad_auto_schedule', 'ad_schedule_interval',
            'ad_schedule_mode', 'ad_max_articles', 'ad_prefix_title', 'ad_log_enabled',
            'ad_replay_cust', 'ad_replay_auto',
        ];
        register_setting( 'ad_settings_group', 'ad_replay_tracks', [ 'sanitize_callback' => 'sanitize_textarea_field' ] );
        // Register per-source schedule options
        foreach ( array_keys( AD_Sources::get_all() ) as $slug ) {
            register_setting( 'ad_settings_group', 'ad_schedule_' . $slug,
                [ 'sanitize_callback' => 'sanitize_text_field' ] );
        }
        foreach ( $options as $opt ) {
            register_setting( 'ad_settings_group', $opt, [ 'sanitize_callback' => 'sanitize_text_field' ] );
        }
    }

    /* =========================================================
       AUTHOR DROPDOWN
       Site users plus guest authors from the 'author' taxonomy
       (wp-admin → Posts → Authors). Values are a WP user ID or
       'term-{id}' for a guest author term.
    ========================================================= */

    private function author_dropdown( $name, $id, $selected, $none_label ) {
        $selected = (string) $selected;

        $users = get_users( [ 'orderby' => 'display_name', 'fields' => [ 'ID', 'display_name', 'user_login' ] ] );
        $terms = [];
        if ( taxonomy_exists( 'author' ) ) {
            $terms = get_terms( [ 'taxonomy' => 'author', 'hide_empty' => false ] );
            if ( is_wp_error( $terms ) ) {
                $terms = [];
            }
        }
        ?>
        <select name="<?php echo esc_attr( $name ); ?>" id="<?php echo esc_attr( $id ); ?>">
            <option value=""><?php echo esc_html( $none_label ); ?></option>
            <?php if ( ! empty( $terms ) ) : ?>
            <optgroup label="<?php esc_attr_e( 'Authors', 'article-duplicator' ); ?>">
                <?php foreach ( $terms as $term ) : $val = 'term-' . $term->term_id; ?>
                <option value="<?php echo esc_attr( $val ); ?>" <?php selected( $selected, $val ); ?>><?php echo esc_html( $term->name ); ?></option>
                <?php endforeach; ?>
            </optgroup>
            <?php endif; ?>
            <optgroup label="<?php esc_attr_e( 'Site Users', 'article-duplicator' ); ?>">
                <?php foreach ( $users as $user ) : ?>
                <option value="<?php echo esc_attr( $user->ID ); ?>" <?php selected( $selected, (string) $user->ID ); ?>><?php echo esc_html( $user->display_name . ' (' . $user->user_login . ')' ); ?></option>
                <?php endforeach; ?>
            </optgroup>
        </select>
        <?php
    }

    /* =========================================================
       ASSETS
    ========================================================= */

    public function enqueue_assets( $hook ) {
        // Load on our plugin pages and on the CPT list screen
        $is_our_page = strpos( $hook, 'article-duplicator' ) !== false
                    || strpos( $hook, 'artdup-' ) !== false
                    || ( isset( $_GET['post_type'] ) && $_GET['post_type'] === 'ad_article' );

        if ( ! $is_our_page ) return;

        wp_enqueue_style( 'artdup-admin', AD_PLUGIN_URL . 'assets/css/admin.css', [], AD_VERSION );
        wp_enqueue_script( 'artdup-admin', AD_PLUGIN_URL . 'assets/js/admin.js', ['jquery'], AD_VERSION, true );
        wp_localize_script( 'artdup-admin', 'AD', [
            'nonce'   => wp_create_nonce( 'ad_nonce' ),
            'ajaxurl' => admin_url( 'admin-ajax.php' ),
            'strings' => [
                'previewing'  => __( 'Fetching articles…', 'article-duplicator' ),
                'importing'   => __( 'Importing articles…', 'article-duplicator' ),
                'testing'     => __( 'Testing connection…', 'article-duplicator' ),
                'confirm_all' => __( 'Import all found articles?', 'article-duplicator' ),
                'confirm_log' => __( 'Clear all import logs?', 'article-duplicator' ),
            ],
        ] );
    }

    /* =========================================================
       PAGE: DASHBOARD
    ========================================================= */

    public function page_dashboard() {
        global $wpdb;
        $log_table  = $wpdb->prefix . 'ad_import_log';
        $total      = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $log_table" );
        $success    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $log_table WHERE status='success'" );
        $skipped    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $log_table WHERE status='skipped'" );
        $errors     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $log_table WHERE status='error'" );
        $scheduler  = new AD_Scheduler();
        $next_run   = $scheduler->get_next_run();
        $source_url = get_option( 'ad_source_url' );
        ?>
        <div class="wrap artdup-wrap">
            <h1 class="artdup-page-title"><span class="dashicons dashicons-migrate"></span> <?php _e( 'Article Duplicator', 'article-duplicator' ); ?></h1>

            <div class="artdup-stats-grid">
                <div class="artdup-stat-card artdup-stat-total">
                    <div class="artdup-stat-icon dashicons dashicons-admin-page"></div>
                    <div class="artdup-stat-value"><?php echo $total; ?></div>
                    <div class="artdup-stat-label"><?php _e( 'Total Imports', 'article-duplicator' ); ?></div>
                </div>
                <div class="artdup-stat-card artdup-stat-success">
                    <div class="artdup-stat-icon dashicons dashicons-yes-alt"></div>
                    <div class="artdup-stat-value"><?php echo $success; ?></div>
                    <div class="artdup-stat-label"><?php _e( 'Successful', 'article-duplicator' ); ?></div>
                </div>
                <div class="artdup-stat-card artdup-stat-skipped">
                    <div class="artdup-stat-icon dashicons dashicons-minus"></div>
                    <div class="artdup-stat-value"><?php echo $skipped; ?></div>
                    <div class="artdup-stat-label"><?php _e( 'Skipped', 'article-duplicator' ); ?></div>
                </div>
                <div class="artdup-stat-card artdup-stat-error">
                    <div class="artdup-stat-icon dashicons dashicons-warning"></div>
                    <div class="artdup-stat-value"><?php echo $errors; ?></div>
                    <div class="artdup-stat-label"><?php _e( 'Errors', 'article-duplicator' ); ?></div>
                </div>
            </div>

            <div class="artdup-dashboard-panels">
                <div class="artdup-panel">
                    <h2><?php _e( 'Quick Actions', 'article-duplicator' ); ?></h2>
                    <div class="artdup-quick-actions">
                        <a href="<?php echo admin_url('admin.php?page=artdup-import'); ?>" class="artdup-btn artdup-btn-primary">
                            <span class="dashicons dashicons-cloud-download"></span> <?php _e( 'Import Now', 'article-duplicator' ); ?>
                        </a>
                        <a href="<?php echo admin_url('edit.php?post_type=ad_article'); ?>" class="artdup-btn artdup-btn-primary">
                            <span class="dashicons dashicons-rss"></span> <?php _e( 'Scraped Articles', 'article-duplicator' ); ?>
                        </a>
                        <a href="<?php echo admin_url('admin.php?page=artdup-settings'); ?>" class="artdup-btn artdup-btn-secondary">
                            <span class="dashicons dashicons-admin-settings"></span> <?php _e( 'Settings', 'article-duplicator' ); ?>
                        </a>
                        <a href="<?php echo admin_url('admin.php?page=artdup-log'); ?>" class="artdup-btn artdup-btn-secondary">
                            <span class="dashicons dashicons-list-view"></span> <?php _e( 'View Log', 'article-duplicator' ); ?>
                        </a>
                    </div>
                </div>

                <div class="artdup-panel">
                    <h2><?php _e( 'Status', 'article-duplicator' ); ?></h2>
                    <table class="artdup-info-table">
                        <?php
                        $active_slug = get_option('ad_source_slug','');
                        $active_src  = $active_slug ? AD_Sources::get($active_slug) : null;
                        $src_label   = $active_src ? $active_src['label'] : __('Custom','article-duplicator');
                        ?>
                        <tr><th><?php _e( 'Active Source', 'article-duplicator' ); ?></th><td>
                            <strong><?php echo esc_html($src_label); ?></strong><br>
                            <a href="<?php echo esc_url($source_url); ?>" target="_blank" style="font-size:.82em;"><?php echo esc_html($source_url); ?></a>
                        </td></tr>
                        <tr>
                            <th><?php _e( 'Auto Schedule', 'article-duplicator' ); ?></th>
                            <td>
                                <?php if ( get_option('ad_auto_schedule') ): ?>
                                <span class="artdup-badge artdup-badge-on"><?php _e('On'); ?></span>
                                &nbsp;<span style="font-size:.82em;color:#6b7280;"><?php echo esc_html( ucfirst( get_option('ad_schedule_mode','together') ) ); ?> mode</span>
                                <?php else: ?>
                                <span class="artdup-badge artdup-badge-off"><?php _e('Off'); ?></span>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php foreach ( $scheduler->get_schedule_status() as $srow ): ?>
                        <tr>
                            <th style="padding-left:20px;font-weight:400;color:#9ca3af;"><?php echo esc_html($srow['source']); ?></th>
                            <td><?php echo esc_html($srow['interval']); ?> &mdash; <strong><?php echo esc_html($srow['next_run']); ?></strong></td>
                        </tr>
                        <?php endforeach; ?>
                        <tr><th><?php _e( 'Post Status', 'article-duplicator' ); ?></th><td><?php echo esc_html( ucfirst( get_option('ad_post_status','draft') ) ); ?></td></tr>
                        <tr><th><?php _e( 'Max per Fetch', 'article-duplicator' ); ?></th><td><?php echo esc_html( get_option('ad_max_articles','20') ); ?></td></tr>
                        <tr><th><?php _e( 'Duplicate Check', 'article-duplicator' ); ?></th><td><?php echo get_option('ad_duplicate_check') ? __('Enabled') : __('Disabled'); ?></td></tr>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

    /* =========================================================
       PAGE: IMPORT
    ========================================================= */

    public function page_import() {
        ?>
        <div class="wrap artdup-wrap">
            <h1 class="artdup-page-title"><span class="dashicons dashicons-cloud-download"></span> <?php _e( 'Import Articles', 'article-duplicator' ); ?></h1>

            <!-- Published By -->
            <div class="artdup-panel">
                <h2><?php _e( 'Published By', 'article-duplicator' ); ?></h2>
                <div class="artdup-row">
                    <?php $this->author_dropdown( 'artdup_author', 'artdup-author', get_option( 'ad_default_author', '' ), __( '— Default author —', 'article-duplicator' ) ); ?>
                </div>
                <p class="description">
                    <?php printf(
                        __( 'Imported articles below will be credited to this user or guest author. Leave on <em>Default author</em> to use the default set in <a href="%s">Settings</a>.', 'article-duplicator' ),
                        admin_url( 'admin.php?page=artdup-settings' )
                    ); ?>
                </p>
            </div>

            <!-- Single Article Import -->
            <div class="artdup-panel">
                <h2><?php _e( 'Import Single Article by URL', 'article-duplicator' ); ?></h2>
                <div class="artdup-row">
                    <input type="url" id="artdup-single-url" class="regular-text" placeholder="https://www.letrot.com/actualites/article-slug" />
                    <button id="artdup-import-single" class="artdup-btn artdup-btn-primary">
                        <span class="dashicons dashicons-cloud-download"></span> <?php _e( 'Import', 'article-duplicator' ); ?>
                    </button>
                </div>
                <div id="artdup-single-result" class="artdup-result-box" style="display:none;"></div>
            </div>

            <!-- Bulk Import -->
            <div class="artdup-panel">
                <h2><?php _e( 'Bulk Import from Source', 'article-duplicator' ); ?></h2>
                <?php
                $imp_slug = get_option('ad_source_slug','');
                $imp_src  = $imp_slug ? AD_Sources::get($imp_slug) : null;
                $imp_label = $imp_src ? $imp_src['label'] : __('Custom source','article-duplicator');
                ?>
                <p class="description">
                    <?php printf(
                        __( 'Source: <strong>%s</strong> &mdash; <a href="%s" target="_blank">%s</a>', 'article-duplicator' ),
                        esc_html($imp_label),
                        esc_url(get_option('ad_source_url')),
                        esc_html(get_option('ad_source_url'))
                    ); ?>
                    &nbsp;&middot;&nbsp; <a href="<?php echo admin_url('admin.php?page=artdup-settings'); ?>"><?php _e('Change source','article-duplicator'); ?></a>
                </p>
                <div class="artdup-btn-row">
                    <button id="artdup-preview-btn" class="artdup-btn artdup-btn-secondary">
                        <span class="dashicons dashicons-visibility"></span> <?php _e( 'Preview Articles', 'article-duplicator' ); ?>
                    </button>
                    <button id="artdup-import-all-btn" class="artdup-btn artdup-btn-primary" style="display:none;">
                        <span class="dashicons dashicons-yes"></span> <?php _e( 'Import All', 'article-duplicator' ); ?>
                    </button>
                    <button id="artdup-test-btn" class="artdup-btn artdup-btn-outline">
                        <span class="dashicons dashicons-admin-plugins"></span> <?php _e( 'Test Connection', 'article-duplicator' ); ?>
                    </button>
                </div>
                <div id="artdup-progress-bar-wrap" style="display:none;" class="artdup-progress-wrap">
                    <div class="artdup-progress-bar"><div id="artdup-progress-bar-inner" style="width:0%"></div></div>
                    <span id="artdup-progress-text"><?php _e( 'Starting…', 'article-duplicator' ); ?></span>
                </div>
                <div id="artdup-preview-results" class="artdup-articles-grid"></div>
                <div id="artdup-import-results" class="artdup-result-box" style="display:none;"></div>
            </div>
        </div>
        <?php
    }

    /* =========================================================
       PAGE: SETTINGS
    ========================================================= */

    public function page_settings() {
        if ( isset( $_POST['ad_save_settings'] ) ) {
            check_admin_referer( 'ad_save_settings_nonce' );
            $this->save_settings();
            echo '<div class="notice notice-success is-dismissible"><p>' . __( 'Settings saved.', 'article-duplicator' ) . '</p></div>';
        }

        $categories = get_categories( ['hide_empty' => false] );
        $post_types = get_post_types( ['public' => true], 'objects' );
        $current_pt = get_option( 'ad_post_type', 'ad_article' );
        ?>
        <div class="wrap artdup-wrap">
            <h1 class="artdup-page-title"><span class="dashicons dashicons-admin-settings"></span> <?php _e( 'Settings', 'article-duplicator' ); ?></h1>
            <form method="post" action="">
                <?php wp_nonce_field( 'ad_save_settings_nonce' ); ?>
                <input type="hidden" name="ad_save_settings" value="1" />

                <!-- SOURCE -->
                <div class="artdup-panel">
                    <h2><?php _e( 'Source Configuration', 'article-duplicator' ); ?></h2>
                    <table class="form-table artdup-form-table">
                        <tr>
                            <th><?php _e( 'News Source', 'article-duplicator' ); ?></th>
                            <td>
                                <?php
                                $current_slug = get_option('ad_source_slug', '');
                                $all_sources  = AD_Sources::get_all();
                                ?>
                                <select name="ad_source_slug" id="artdup-source-slug">
                                    <?php foreach ( AD_Sources::dropdown_options() as $slug => $label ): ?>
                                    <option value="<?php echo esc_attr($slug); ?>" <?php selected($current_slug, $slug); ?>>
                                        <?php echo esc_html($label); ?>
                                    </option>
                                    <?php endforeach; ?>
                                </select>
                                <p class="description">
                                    <?php _e( 'Select a pre-configured source, or choose <em>Custom URL</em> to enter your own.', 'article-duplicator' ); ?>
                                </p>
                                <?php foreach ( $all_sources as $slug => $src ): ?>
                                <p class="description artdup-source-hint" data-slug="<?php echo esc_attr($slug); ?>"
                                   style="<?php echo $current_slug === $slug ? '' : 'display:none;'; ?>">
                                    <strong><?php echo esc_html($src['label']); ?></strong> &mdash;
                                    <?php _e('Listing:', 'article-duplicator'); ?>
                                    <a href="<?php echo esc_url($src['url']); ?>" target="_blank"><?php echo esc_html($src['url']); ?></a>
                                    &nbsp;&middot;&nbsp; <?php _e('Language:', 'article-duplicator'); ?> <code><?php echo esc_html($src['lang']); ?></code>
                                </p>
                                <?php endforeach; ?>
                            </td>
                        </tr>
                        <tr id="artdup-custom-url-row" style="<?php echo empty($current_slug) ? '' : 'display:none;'; ?>">
                            <th><?php _e( 'Custom Source URL', 'article-duplicator' ); ?></th>
                            <td>
                                <input type="url" name="ad_source_url" id="artdup-source-url"
                                       value="<?php echo esc_attr( get_option('ad_source_url') ); ?>"
                                       class="regular-text" placeholder="https://example.com/news" />
                                <p class="description"><?php _e( 'Listing page URL for a custom source.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Max Articles per Fetch', 'article-duplicator' ); ?></th>
                            <td>
                                <input type="number" name="ad_max_articles" value="<?php echo esc_attr( get_option('ad_max_articles','20') ); ?>" min="1" max="100" class="small-text" />
                                <p class="description"><?php _e( 'Maximum number of articles to fetch in one run.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- CONTENT -->
                <div class="artdup-panel">
                    <h2><?php _e( 'Content Settings', 'article-duplicator' ); ?></h2>
                    <table class="form-table artdup-form-table">
                        <tr>
                            <th><?php _e( 'Post Status', 'article-duplicator' ); ?></th>
                            <td>
                                <select name="ad_post_status">
                                    <?php foreach (['draft','publish','pending','private'] as $s): ?>
                                    <option value="<?php echo $s; ?>" <?php selected( get_option('ad_post_status','draft'), $s ); ?>><?php echo ucfirst($s); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Post Type', 'article-duplicator' ); ?></th>
                            <td>
                                <select name="ad_post_type">
                                    <?php foreach ($post_types as $pt):
                                        $label = $pt->label;
                                        if ( $pt->name === 'ad_article' ) $label .= ' ★ ' . __('(Recommended)', 'article-duplicator');
                                    ?>
                                    <option value="<?php echo esc_attr($pt->name); ?>" <?php selected( $current_pt, $pt->name ); ?>><?php echo esc_html($label); ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <p class="description"><?php _e( '<strong>Scraped Articles</strong> (ad_article) is the dedicated CPT — recommended.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Default Author', 'article-duplicator' ); ?></th>
                            <td>
                                <?php $this->author_dropdown( 'ad_default_author', 'ad-default-author', get_option( 'ad_default_author', '' ), __( '— Harnesslink account (legacy) —', 'article-duplicator' ) ); ?>
                                <p class="description"><?php _e( 'Who is credited as the author of imported articles (including scheduled auto-imports) — a site user or a guest author from the Authors taxonomy. Can be overridden per import on the Import page. When the source article has no byline, this name is also used as the byline.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Default Category', 'article-duplicator' ); ?></th>
                            <td>
                                <select name="ad_default_category">
                                    <option value=""><?php _e( '— None —', 'article-duplicator' ); ?></option>
                                    <?php foreach ($categories as $cat): ?>
                                    <option value="<?php echo $cat->term_id; ?>" <?php selected( get_option('ad_default_category'), $cat->term_id ); ?>><?php echo esc_html($cat->name); ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <p class="description"><?php _e( 'Uses the normal WordPress Categories taxonomy shown in the Harnesslink editor.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Title Prefix', 'article-duplicator' ); ?></th>
                            <td>
                                <input type="text" name="ad_prefix_title" value="<?php echo esc_attr( get_option('ad_prefix_title','') ); ?>" class="regular-text" placeholder="<?php _e('e.g. [Le Trot]', 'article-duplicator'); ?>" />
                                <p class="description"><?php _e( 'Optional prefix added before each imported post title.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- IMAGES -->
                <div class="artdup-panel">
                    <h2><?php _e( 'Image Settings', 'article-duplicator' ); ?></h2>
                    <table class="form-table artdup-form-table">
                        <tr>
                            <th><?php _e( 'Import Featured Image', 'article-duplicator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="ad_import_featured" value="1" <?php checked( get_option('ad_import_featured','1'), '1' ); ?> />
                                    <?php _e( 'Download and set the article thumbnail as featured image', 'article-duplicator' ); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Import Inline Images', 'article-duplicator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="ad_import_images" value="1" <?php checked( get_option('ad_import_images','1'), '1' ); ?> />
                                    <?php _e( 'Download images found in article body to media library', 'article-duplicator' ); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- RACE REPLAYS -->
                <div class="artdup-panel">
                    <h2><?php _e( 'Race Replays', 'article-duplicator' ); ?></h2>
                    <table class="form-table artdup-form-table">
                        <tr>
                            <th><?php _e( 'Customer Code', 'article-duplicator' ); ?></th>
                            <td>
                                <input type="text" name="ad_replay_cust" value="<?php echo esc_attr( get_option('ad_replay_cust','HarnessLink') ); ?>" class="regular-text" />
                                <p class="description"><?php _e( 'The <code>cust</code> parameter in the Roberts Stream replay URL. Usually <strong>HarnessLink</strong>.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Track Codes', 'article-duplicator' ); ?></th>
                            <td>
                                <textarea name="ad_replay_tracks" rows="6" class="large-text code" placeholder="PRD|Track Name&#10;CODE|Another Track"><?php echo esc_textarea( get_option('ad_replay_tracks','') ); ?></textarea>
                                <p class="description"><?php _e( 'One track per line in the format <code>CODE|Track Name</code> (e.g. <code>PRD|…</code>). Codes appear as suggestions in the Race Replay box on the post editor, and the track name is used to auto-detect replays during import.', 'article-duplicator' ); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Auto-Attach on Import', 'article-duplicator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="ad_replay_auto" value="1" <?php checked( get_option('ad_replay_auto','1'), '1' ); ?> />
                                    <?php _e( 'Try to detect the track and race number in scraped articles and attach the replay player automatically (uses the track list above).', 'article-duplicator' ); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- DEDUPLICATION -->
                <div class="artdup-panel">
                    <h2><?php _e( 'Deduplication & Logging', 'article-duplicator' ); ?></h2>
                    <table class="form-table artdup-form-table">
                        <tr>
                            <th><?php _e( 'Duplicate Check', 'article-duplicator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="ad_duplicate_check" value="1" <?php checked( get_option('ad_duplicate_check','1'), '1' ); ?> />
                                    <?php _e( 'Skip articles that have already been imported (by source URL)', 'article-duplicator' ); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th><?php _e( 'Enable Logging', 'article-duplicator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="ad_log_enabled" value="1" <?php checked( get_option('ad_log_enabled','1'), '1' ); ?> />
                                    <?php _e( 'Record import activity in the log table', 'article-duplicator' ); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- SCHEDULE -->
                <div class="artdup-panel">
                    <h2><?php _e( 'Auto-Import Schedule', 'article-duplicator' ); ?></h2>
                    <table class="form-table artdup-form-table">

                        <tr>
                            <th><?php _e( 'Enable Auto-Import', 'article-duplicator' ); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="ad_auto_schedule" id="artdup-auto-schedule" value="1"
                                           <?php checked( get_option('ad_auto_schedule','0'), '1' ); ?> />
                                    <?php _e( 'Automatically import articles on a schedule using WP-Cron', 'article-duplicator' ); ?>
                                </label>
                            </td>
                        </tr>

                        <tbody id="artdup-schedule-options" style="<?php echo get_option('ad_auto_schedule','0') ? '' : 'display:none;'; ?>">

                        <tr>
                            <th><?php _e( 'Schedule Mode', 'article-duplicator' ); ?></th>
                            <td>
                                <?php $smode = get_option('ad_schedule_mode','together'); ?>
                                <fieldset>
                                    <label style="display:block;margin-bottom:8px;">
                                        <input type="radio" name="ad_schedule_mode" value="together" <?php checked($smode,'together'); ?> class="artdup-smode-radio" />
                                        <strong><?php _e('Together','article-duplicator'); ?></strong> &mdash;
                                        <?php _e('All sources run at the same time on one shared interval.','article-duplicator'); ?>
                                    </label>
                                    <label style="display:block;margin-bottom:8px;">
                                        <input type="radio" name="ad_schedule_mode" value="alternating" <?php checked($smode,'alternating'); ?> class="artdup-smode-radio" />
                                        <strong><?php _e('Alternating','article-duplicator'); ?></strong> &mdash;
                                        <?php _e('Sources take turns. Le Trot runs first, then US Trotting News at a staggered offset, then back to Le Trot — all within one shared interval cycle.','article-duplicator'); ?>
                                    </label>
                                    <label style="display:block;">
                                        <input type="radio" name="ad_schedule_mode" value="independent" <?php checked($smode,'independent'); ?> class="artdup-smode-radio" />
                                        <strong><?php _e('Independent','article-duplicator'); ?></strong> &mdash;
                                        <?php _e('Each source runs on its own interval, completely independently.','article-duplicator'); ?>
                                    </label>
                                </fieldset>
                            </td>
                        </tr>

                        <!-- Shared interval (Together + Alternating modes) -->
                        <tr class="artdup-shared-interval" style="<?php echo $smode === 'independent' ? 'display:none;' : ''; ?>">
                            <th><?php _e( 'Shared Interval', 'article-duplicator' ); ?></th>
                            <td>
                                <?php $shared_intervals = [
                                    'every_15_minutes' => __('Every 15 Minutes','article-duplicator'),
                                    'every_30_minutes' => __('Every 30 Minutes','article-duplicator'),
                                    'hourly'           => __('Hourly','article-duplicator'),
                                    'every_6_hours'    => __('Every 6 Hours','article-duplicator'),
                                    'every_12_hours'   => __('Every 12 Hours','article-duplicator'),
                                    'daily'            => __('Daily','article-duplicator'),
                                ]; ?>
                                <select name="ad_schedule_interval">
                                    <?php foreach ($shared_intervals as $val => $lbl): ?>
                                    <option value="<?php echo $val; ?>" <?php selected(get_option('ad_schedule_interval','hourly'),$val); ?>><?php echo $lbl; ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <p class="description artdup-alternating-hint" style="<?php echo $smode === 'alternating' ? '' : 'display:none;'; ?>">
                                    <?php
                                    $src_count = count(AD_Sources::get_all());
                                    printf(
                                        __('With %d sources the stagger offset is <strong>interval ÷ %d</strong>. Example: Hourly → each source runs every hour, %d minutes apart.','article-duplicator'),
                                        $src_count, $src_count, (int)(60 / $src_count)
                                    ); ?>
                                </p>
                            </td>
                        </tr>

                        <!-- Per-source intervals (Independent mode) -->
                        <tr class="artdup-independent-intervals" style="<?php echo $smode === 'independent' ? '' : 'display:none;'; ?>">
                            <th><?php _e('Per-Source Intervals','article-duplicator'); ?></th>
                            <td>
                                <?php foreach (AD_Sources::get_all() as $slug => $src):
                                    $saved_iv = get_option('ad_schedule_' . $slug, 'hourly');
                                ?>
                                <div style="margin-bottom:10px;">
                                    <label><strong><?php echo esc_html($src['label']); ?></strong></label><br>
                                    <select name="ad_schedule_<?php echo esc_attr($slug); ?>" style="margin-top:4px;">
                                        <?php foreach ($shared_intervals as $val => $lbl): ?>
                                        <option value="<?php echo $val; ?>" <?php selected($saved_iv,$val); ?>><?php echo $lbl; ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <?php endforeach; ?>
                                <p class="description"><?php _e('Each source runs completely independently on its own cron event.','article-duplicator'); ?></p>
                            </td>
                        </tr>

                        <!-- Preview / next-run table -->
                        <tr>
                            <th><?php _e('Current Schedule','article-duplicator'); ?></th>
                            <td>
                                <?php
                                $scheduler = new AD_Scheduler();
                                $status    = $scheduler->get_schedule_status();
                                if ( empty($status) ): ?>
                                    <p class="description"><?php _e('Save settings to activate the schedule.','article-duplicator'); ?></p>
                                <?php else: ?>
                                <table class="widefat striped" style="max-width:540px;">
                                    <thead><tr>
                                        <th><?php _e('Source','article-duplicator'); ?></th>
                                        <th><?php _e('Interval','article-duplicator'); ?></th>
                                        <th><?php _e('Next Run','article-duplicator'); ?></th>
                                    </tr></thead>
                                    <tbody>
                                    <?php foreach ($status as $row): ?>
                                    <tr>
                                        <td><?php echo esc_html($row['source']); ?></td>
                                        <td><?php echo esc_html($row['interval']); ?></td>
                                        <td><?php echo esc_html($row['next_run']); ?></td>
                                    </tr>
                                    <?php endforeach; ?>
                                    </tbody>
                                </table>
                                <?php endif; ?>
                            </td>
                        </tr>

                        </tbody><!-- /artdup-schedule-options -->

                    </table>
                </div>

                <p class="submit">
                    <button type="submit" class="artdup-btn artdup-btn-primary button-primary">
                        <span class="dashicons dashicons-saved"></span> <?php _e( 'Save Settings', 'article-duplicator' ); ?>
                    </button>
                </p>
            </form>
        </div>
        <?php
    }

    private function save_settings() {
        // Save source slug first, then resolve the actual URL
        $slug = sanitize_text_field( $_POST['ad_source_slug'] ?? '' );
        update_option( 'ad_source_slug', $slug );

        if ( ! empty( $slug ) ) {
            // Pre-configured source: use its default URL automatically
            $src = AD_Sources::get( $slug );
            if ( $src ) {
                update_option( 'ad_source_url', esc_url_raw( $src['url'] ) );
            }
        } else {
            // Custom URL: save whatever was typed
            update_option( 'ad_source_url', esc_url_raw( $_POST['ad_source_url'] ?? '' ) );
        }

        $fields = [
            'ad_post_status'       => 'sanitize_text_field',
            'ad_post_type'         => 'sanitize_text_field',
            'ad_default_category'  => 'absint',
            'ad_default_author'    => 'sanitize_text_field',
            'ad_max_articles'      => 'absint',
            'ad_prefix_title'      => 'sanitize_text_field',
            'ad_schedule_interval' => 'sanitize_text_field',
            'ad_schedule_mode'     => 'sanitize_text_field',
            'ad_replay_cust'       => 'sanitize_text_field',
            'ad_replay_tracks'     => 'sanitize_textarea_field',
        ];
        foreach ($fields as $key => $fn) {
            update_option( $key, $fn( $_POST[$key] ?? '' ) );
        }
        foreach (['ad_import_images','ad_import_featured','ad_duplicate_check','ad_auto_schedule','ad_log_enabled','ad_replay_auto'] as $chk) {
            update_option( $chk, isset( $_POST[$chk] ) ? '1' : '0' );
        }
        // Per-source independent intervals
        foreach ( array_keys( AD_Sources::get_all() ) as $slug ) {
            $key = 'ad_schedule_' . $slug;
            if ( isset( $_POST[ $key ] ) ) {
                update_option( $key, sanitize_text_field( $_POST[ $key ] ) );
            }
        }
        // Re-apply schedule after saving
        $scheduler = new AD_Scheduler();
        $scheduler->reschedule_all();
    }

    /* =========================================================
       PAGE: LOG
    ========================================================= */

    public function page_log() {
        $importer = new AD_Importer();
        $logs     = $importer->get_logs( 100 );
        ?>
        <div class="wrap artdup-wrap">
            <h1 class="artdup-page-title">
                <span class="dashicons dashicons-list-view"></span> <?php _e( 'Import Log', 'article-duplicator' ); ?>
                <button id="artdup-clear-log-btn" class="artdup-btn artdup-btn-danger button" style="float:right;margin-top:4px;">
                    <span class="dashicons dashicons-trash"></span> <?php _e( 'Clear Log', 'article-duplicator' ); ?>
                </button>
            </h1>

            <?php if ( empty($logs) ): ?>
                <div class="artdup-empty-state">
                    <span class="dashicons dashicons-database"></span>
                    <p><?php _e( 'No import records yet. Run your first import to see results here.', 'article-duplicator' ); ?></p>
                </div>
            <?php else: ?>
            <table class="wp-list-table widefat fixed striped artdup-log-table">
                <thead>
                    <tr>
                        <th width="30">#</th>
                        <th width="80"><?php _e('Status'); ?></th>
                        <th><?php _e('Title'); ?></th>
                        <th><?php _e('Source URL'); ?></th>
                        <th width="60"><?php _e('Post'); ?></th>
                        <th width="160"><?php _e('Date'); ?></th>
                        <th><?php _e('Message'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($logs as $log): ?>
                    <tr>
                        <td><?php echo $log->id; ?></td>
                        <td>
                            <span class="artdup-badge artdup-badge-<?php echo esc_attr($log->status); ?>">
                                <?php echo esc_html(ucfirst($log->status)); ?>
                            </span>
                        </td>
                        <td><?php echo esc_html( $log->post_title ); ?></td>
                        <td><a href="<?php echo esc_url($log->source_url); ?>" target="_blank" title="<?php echo esc_attr($log->source_url); ?>">
                            <?php echo esc_html( wp_trim_words($log->source_url, 5) ); ?></a></td>
                        <td><?php if ($log->post_id): ?><a href="<?php echo get_edit_post_link($log->post_id); ?>">#<?php echo $log->post_id; ?></a><?php endif; ?></td>
                        <td><?php echo esc_html($log->imported_at); ?></td>
                        <td><?php echo esc_html($log->message); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
        <?php
    }
}
