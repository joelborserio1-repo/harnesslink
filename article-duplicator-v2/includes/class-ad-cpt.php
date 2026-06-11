<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_CPT {

    const POST_TYPE = 'ad_article';
    const TAXONOMY  = 'ad_article_cat';

    public function __construct() {
        add_action( 'init',                  [ $this, 'register_post_type' ] );
        add_action( 'init',                  [ $this, 'register_taxonomy' ] );
        add_action( 'init',                  [ $this, 'register_editor_taxonomies' ], 20 );

        // Admin list columns
        add_filter( 'manage_ad_article_posts_columns',       [ $this, 'custom_columns' ] );
        add_action( 'manage_ad_article_posts_custom_column', [ $this, 'render_column' ], 10, 2 );
        add_filter( 'manage_edit-ad_article_sortable_columns', [ $this, 'sortable_columns' ] );

        // Row actions
        add_filter( 'post_row_actions', [ $this, 'row_actions' ], 10, 2 );

        // Filter bar
        add_action( 'restrict_manage_posts', [ $this, 'filter_bar' ] );
        add_filter( 'parse_query',           [ $this, 'filter_query' ] );

        // Meta box
        add_action( 'add_meta_boxes', [ $this, 'add_meta_box' ] );

        // Dashboard widget
        add_action( 'wp_dashboard_setup', [ $this, 'dashboard_widget' ] );
    }

    /* =========================================================
       POST TYPE
    ========================================================= */

    public function register_post_type() {
        $labels = [
            'name'               => __( 'Scraped Articles',        'article-duplicator' ),
            'singular_name'      => __( 'Scraped Article',         'article-duplicator' ),
            'menu_name'          => __( 'Scraped Articles',        'article-duplicator' ),
            'add_new'            => __( 'Add New',                 'article-duplicator' ),
            'add_new_item'       => __( 'Add New Article',         'article-duplicator' ),
            'edit_item'          => __( 'Edit Article',            'article-duplicator' ),
            'new_item'           => __( 'New Article',             'article-duplicator' ),
            'view_item'          => __( 'View Article',            'article-duplicator' ),
            'search_items'       => __( 'Search Articles',         'article-duplicator' ),
            'not_found'          => __( 'No scraped articles found.', 'article-duplicator' ),
            'not_found_in_trash' => __( 'No articles in trash.',   'article-duplicator' ),
            'all_items'          => __( 'All Scraped Articles',    'article-duplicator' ),
        ];

        register_post_type( self::POST_TYPE, [
            'labels'              => $labels,
            'public'              => true,
            'publicly_queryable'  => true,
            'show_ui'             => true,
            'show_in_menu'        => 'article-duplicator', // nested under our plugin menu
            'show_in_rest'        => true,
            'query_var'           => true,
            'rewrite'             => [ 'slug' => '', 'with_front' => false ],
            'capability_type'     => 'post',
            'has_archive'         => false,
            'hierarchical'        => false,
            'menu_icon'           => 'dashicons-rss',
            'supports'            => [ 'title', 'editor', 'excerpt', 'thumbnail', 'author', 'custom-fields', 'revisions' ],
            'taxonomies'          => [ 'category', 'post_tag', 'country', 'countries', 'author', 'authors', 'guest_author', 'guest-author' ],
        ] );
    }

    /* =========================================================
       TAXONOMY
    ========================================================= */

    public function register_taxonomy() {
        $labels = [
            'name'              => __( 'Article Categories', 'article-duplicator' ),
            'singular_name'     => __( 'Article Category',  'article-duplicator' ),
            'search_items'      => __( 'Search Categories', 'article-duplicator' ),
            'all_items'         => __( 'All Categories',    'article-duplicator' ),
            'edit_item'         => __( 'Edit Category',     'article-duplicator' ),
            'update_item'       => __( 'Update Category',   'article-duplicator' ),
            'add_new_item'      => __( 'Add New Category',  'article-duplicator' ),
            'new_item_name'     => __( 'New Category Name', 'article-duplicator' ),
            'menu_name'         => __( 'Categories',        'article-duplicator' ),
        ];

        register_taxonomy( self::TAXONOMY, self::POST_TYPE, [
            'labels'            => $labels,
            'hierarchical'      => true,
            'show_ui'           => false,
            'show_in_rest'      => false,
            'show_admin_column' => false,
            'rewrite'           => [ 'slug' => 'scraped-article-cat' ],
        ] );
    }

    /**
     * Attach the same WordPress editor taxonomies used by Harnesslink posts.
     *
     * The private ad_article_cat taxonomy is intentionally hidden from the
     * editor so imports use Categories, Tags, and Countries like normal posts.
     */
    public function register_editor_taxonomies() {
        foreach ( [ 'category', 'post_tag', 'country', 'countries', 'author', 'authors', 'guest_author', 'guest-author' ] as $taxonomy ) {
            if ( taxonomy_exists( $taxonomy ) ) {
                register_taxonomy_for_object_type( $taxonomy, self::POST_TYPE );
            }
        }
    }

    /* =========================================================
       ADMIN COLUMNS
    ========================================================= */

    public function custom_columns( $columns ) {
        // Rebuild column order
        $new = [];
        $new['cb']              = $columns['cb'];
        $new['thumbnail']       = __( 'Image', 'article-duplicator' );
        $new['title']           = $columns['title'];
        $new['categories']      = __( 'Categories', 'article-duplicator' );
        $new['source_url']      = __( 'Source URL', 'article-duplicator' );
        $new['scraped_date']    = __( 'Scraped On', 'article-duplicator' );
        $new['original_date']   = __( 'Original Date', 'article-duplicator' );
        $new['post_status_col'] = __( 'Status', 'article-duplicator' );
        $new['date']            = $columns['date'];
        return $new;
    }

    public function render_column( $column, $post_id ) {
        switch ( $column ) {

            case 'thumbnail':
                if ( has_post_thumbnail( $post_id ) ) {
                    echo '<div style="width:64px;height:48px;overflow:hidden;border-radius:4px;">';
                    echo get_the_post_thumbnail( $post_id, [ 64, 48 ], [ 'style' => 'width:100%;height:100%;object-fit:cover;' ] );
                    echo '</div>';
                } else {
                    echo '<div style="width:64px;height:48px;background:#f3f4f6;border-radius:4px;display:flex;align-items:center;justify-content:center;">';
                    echo '<span class="dashicons dashicons-format-image" style="color:#d1d5db;"></span>';
                    echo '</div>';
                }
                break;

            case 'source_url':
                $url = get_post_meta( $post_id, '_ad_source_url', true );
                if ( $url ) {
                    $host = parse_url( $url, PHP_URL_HOST );
                    echo '<a href="' . esc_url( $url ) . '" target="_blank" title="' . esc_attr( $url ) . '" style="font-size:.8rem;">';
                    echo esc_html( $host ) . ' &#8599;';
                    echo '</a>';
                } else {
                    echo '<span style="color:#9ca3af;">—</span>';
                }
                break;

            case 'categories':
                $terms = get_the_terms( $post_id, 'category' );
                if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
                    echo esc_html( implode( ', ', wp_list_pluck( $terms, 'name' ) ) );
                } else {
                    echo '<span style="color:#9ca3af;">—</span>';
                }
                break;

            case 'scraped_date':
                $date = get_post_meta( $post_id, '_ad_scraped_date', true );
                echo $date
                    ? '<span style="font-size:.8rem;color:#6b7280;">' . esc_html( date_i18n( get_option('date_format') . ' ' . get_option('time_format'), strtotime($date) ) ) . '</span>'
                    : '<span style="color:#9ca3af;">—</span>';
                break;

            case 'original_date':
                $date = get_post_meta( $post_id, '_ad_original_date', true );
                if ( $date ) {
                    $ts = strtotime( $date );
                    echo '<span style="font-size:.8rem;color:#6b7280;">' . ( $ts ? date_i18n( get_option('date_format'), $ts ) : esc_html($date) ) . '</span>';
                } else {
                    echo '<span style="color:#9ca3af;">—</span>';
                }
                break;

            case 'post_status_col':
                $status = get_post_status( $post_id );
                $labels = [
                    'publish' => [ 'Published', '#057a55', '#d1fae5' ],
                    'draft'   => [ 'Draft',     '#92400e', '#fef3c7' ],
                    'pending' => [ 'Pending',   '#1e40af', '#dbeafe' ],
                    'private' => [ 'Private',   '#6b21a8', '#f3e8ff' ],
                    'trash'   => [ 'Trash',     '#9f1239', '#ffe4e6' ],
                ];
                $info = $labels[ $status ] ?? [ ucfirst($status), '#6b7280', '#f3f4f6' ];
                echo '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:.73rem;font-weight:600;color:' . $info[1] . ';background:' . $info[2] . ';">' . $info[0] . '</span>';
                break;
        }
    }

    public function sortable_columns( $columns ) {
        $columns['scraped_date']  = 'scraped_date';
        $columns['original_date'] = 'original_date';
        return $columns;
    }

    /* =========================================================
       ROW ACTIONS
    ========================================================= */

    public function row_actions( $actions, $post ) {
        if ( $post->post_type !== self::POST_TYPE ) return $actions;

        $url = get_post_meta( $post->ID, '_ad_source_url', true );
        if ( $url ) {
            $actions['view_source'] = '<a href="' . esc_url( $url ) . '" target="_blank">View Source &#8599;</a>';
        }

        return $actions;
    }

    /* =========================================================
       FILTER BAR
    ========================================================= */

    public function filter_bar( $post_type ) {
        if ( $post_type !== self::POST_TYPE ) return;

        // Filter by scraped status (has source URL or not)
        $current = $_GET['ad_has_source'] ?? '';
        echo '<select name="ad_has_source">';
        echo '<option value="">' . __( 'All Sources', 'article-duplicator' ) . '</option>';
        echo '<option value="yes" ' . selected( $current, 'yes', false ) . '>' . __( 'Has Source URL', 'article-duplicator' ) . '</option>';
        echo '<option value="no"  ' . selected( $current, 'no',  false ) . '>' . __( 'No Source URL',  'article-duplicator' ) . '</option>';
        echo '</select>';
    }

    public function filter_query( $query ) {
        global $pagenow;
        if ( ! is_admin() || $pagenow !== 'edit.php' ) return;
        if ( ( $query->query['post_type'] ?? '' ) !== self::POST_TYPE ) return;

        $has_source = $_GET['ad_has_source'] ?? '';
        if ( $has_source === 'yes' ) {
            $query->set( 'meta_key', '_ad_source_url' );
            $query->set( 'meta_compare', 'EXISTS' );
        } elseif ( $has_source === 'no' ) {
            $query->set( 'meta_query', [
                [ 'key' => '_ad_source_url', 'compare' => 'NOT EXISTS' ],
            ] );
        }
    }

    /* =========================================================
       META BOX
    ========================================================= */

    public function add_meta_box() {
        add_meta_box(
            'ad_article_source',
            __( 'Scraper Info', 'article-duplicator' ),
            [ $this, 'render_meta_box' ],
            self::POST_TYPE,
            'side',
            'high'
        );
    }

    public function render_meta_box( $post ) {
        $source_url    = get_post_meta( $post->ID, '_ad_source_url',    true );
        $scraped_date  = get_post_meta( $post->ID, '_ad_scraped_date',  true );
        $original_date = get_post_meta( $post->ID, '_ad_original_date', true );
        ?>
        <div class="artdup-meta-box">
            <?php if ( $source_url ): ?>
            <div class="artdup-meta-row">
                <span class="artdup-meta-label"><?php _e( 'Source', 'article-duplicator' ); ?></span>
                <a href="<?php echo esc_url( $source_url ); ?>" target="_blank" class="artdup-meta-value artdup-meta-link">
                    <?php echo esc_html( parse_url( $source_url, PHP_URL_HOST ) ); ?> &#8599;
                </a>
            </div>
            <div class="artdup-meta-row">
                <span class="artdup-meta-label"><?php _e( 'Full URL', 'article-duplicator' ); ?></span>
                <span class="artdup-meta-value artdup-meta-url"><?php echo esc_html( $source_url ); ?></span>
            </div>
            <?php endif; ?>
            <?php if ( $scraped_date ): ?>
            <div class="artdup-meta-row">
                <span class="artdup-meta-label"><?php _e( 'Scraped', 'article-duplicator' ); ?></span>
                <span class="artdup-meta-value"><?php echo esc_html( date_i18n( 'Y-m-d H:i', strtotime( $scraped_date ) ) ); ?></span>
            </div>
            <?php endif; ?>
            <?php if ( $original_date ): ?>
            <div class="artdup-meta-row">
                <span class="artdup-meta-label"><?php _e( 'Published', 'article-duplicator' ); ?></span>
                <span class="artdup-meta-value"><?php echo esc_html( $original_date ); ?></span>
            </div>
            <?php endif; ?>
            <?php if ( ! $source_url ): ?>
            <p style="color:#9ca3af;font-size:.82rem;margin:0;"><?php _e( 'No scraper metadata available.', 'article-duplicator' ); ?></p>
            <?php endif; ?>
        </div>
        <style>
        .artdup-meta-box { font-size: .82rem; }
        .artdup-meta-row { display:flex; flex-direction:column; gap:2px; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f3f4f6; }
        .artdup-meta-row:last-child { border-bottom:none; margin-bottom:0; }
        .artdup-meta-label { font-weight:600; color:#6b7280; text-transform:uppercase; font-size:.7rem; letter-spacing:.05em; }
        .artdup-meta-value { color:#111827; word-break:break-all; }
        .artdup-meta-link  { color:#1a56db; text-decoration:none; }
        .artdup-meta-link:hover { text-decoration:underline; }
        .artdup-meta-url   { font-size:.75rem; color:#6b7280; }
        </style>
        <?php
    }

    /* =========================================================
       DASHBOARD WIDGET
    ========================================================= */

    public function dashboard_widget() {
        wp_add_dashboard_widget(
            'ad_dashboard_widget',
            __( 'Article Duplicator — Recent Imports', 'article-duplicator' ),
            [ $this, 'render_dashboard_widget' ]
        );
    }

    public function render_dashboard_widget() {
        $posts = get_posts( [
            'post_type'      => self::POST_TYPE,
            'posts_per_page' => 5,
            'post_status'    => 'any',
            'orderby'        => 'date',
            'order'          => 'DESC',
        ] );

        if ( empty( $posts ) ) {
            echo '<p style="color:#9ca3af;">' . __( 'No articles imported yet.', 'article-duplicator' ) . '</p>';
        } else {
            echo '<ul style="margin:0;padding:0;list-style:none;">';
            foreach ( $posts as $p ) {
                $status = get_post_status( $p->ID );
                echo '<li style="padding:6px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:8px;">';
                echo '<a href="' . get_edit_post_link( $p->ID ) . '" style="flex:1;font-size:.85rem;color:#111827;text-decoration:none;">' . esc_html( $p->post_title ) . '</a>';
                echo '<span style="font-size:.72rem;padding:1px 6px;border-radius:99px;background:#f3f4f6;color:#6b7280;">' . ucfirst( $status ) . '</span>';
                echo '</li>';
            }
            echo '</ul>';
            echo '<p style="margin-top:12px;"><a href="' . admin_url( 'edit.php?post_type=' . self::POST_TYPE ) . '">' . __( 'View all scraped articles →', 'article-duplicator' ) . '</a></p>';
        }
    }

    /* =========================================================
       STATIC HELPERS
    ========================================================= */

    public static function get_post_type() {
        return self::POST_TYPE;
    }

    public static function get_taxonomy() {
        return self::TAXONOMY;
    }
}
