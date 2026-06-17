<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Convert existing Scraped Articles (ad_article) into normal Posts.
 *
 * Molongui (free) and the JNews slider only support the standard "post"
 * type, so moving imported articles to "post" makes guest-author bylines
 * and slider/featured placement work. This screen converts existing
 * ad_article entries in batches and (optionally) flips the importer's
 * Post Type setting so future imports are Posts too.
 *
 * post_type is changed with set_post_type() — content, meta (including the
 * Molongui author pointer), date, and term relationships are preserved.
 */
class AD_Convert {

    const BATCH = 100;

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_menu' ], 21 );
    }

    public function register_menu() {
        add_submenu_page(
            'article-duplicator',
            __( 'Convert to Posts', 'article-duplicator' ),
            __( 'Convert to Posts', 'article-duplicator' ),
            'manage_options',
            'artdup-convert',
            [ $this, 'page' ]
        );
    }

    private function count_remaining() {
        $q = new WP_Query( [
            'post_type'      => AD_CPT::POST_TYPE,
            'post_status'    => 'any',
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'no_found_rows'  => false,
        ] );
        return (int) $q->found_posts;
    }

    private function handle() {
        if ( empty( $_POST['ad_convert_action'] ) ) return '';
        if ( ! current_user_can( 'manage_options' ) ) return '';
        check_admin_referer( 'ad_convert' );

        $messages = [];

        // Flip the importer Post Type setting so new imports are Posts.
        if ( ! empty( $_POST['ad_set_default_post'] ) ) {
            update_option( 'ad_post_type', 'post' );
            $messages[] = __( 'New imports will now publish as Posts.', 'article-duplicator' );
        }

        if ( 'convert' === $_POST['ad_convert_action'] ) {
            $ids = get_posts( [
                'post_type'      => AD_CPT::POST_TYPE,
                'post_status'    => 'any',
                'posts_per_page' => self::BATCH,
                'fields'         => 'ids',
                'orderby'        => 'ID',
                'order'          => 'ASC',
            ] );

            $done = 0;
            foreach ( $ids as $id ) {
                set_post_type( $id, 'post' );
                $done++;
            }
            $messages[] = sprintf( __( 'Converted %d article(s) to Posts.', 'article-duplicator' ), $done );
        }

        return implode( ' ', $messages );
    }

    public function page() {
        $notice    = $this->handle();
        $remaining = $this->count_remaining();
        $is_post   = ( 'post' === get_option( 'ad_post_type', AD_CPT::POST_TYPE ) );
        ?>
        <div class="wrap artdup-wrap">
            <h1 class="artdup-page-title"><span class="dashicons dashicons-migrate"></span> <?php _e( 'Convert Scraped Articles to Posts', 'article-duplicator' ); ?></h1>

            <?php if ( $notice ) : ?>
            <div class="notice notice-success is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
            <?php endif; ?>

            <div class="artdup-panel">
                <h2><?php _e( 'Why convert?', 'article-duplicator' ); ?></h2>
                <p class="description" style="max-width:760px;">
                    <?php _e( 'Guest-author bylines (Molongui) and the JNews slider only work on the standard <strong>Posts</strong> type. Converting your <strong>Scraped Articles</strong> to Posts makes the author you select display on the live site and lets these articles appear in sliders/featured blocks.', 'article-duplicator' ); ?>
                </p>
                <p class="description" style="max-width:760px;color:#b32d2e;">
                    <strong><?php _e( 'Important:', 'article-duplicator' ); ?></strong>
                    <?php _e( 'Converting changes each article\'s URL from <code>/ad_article/slug/</code> to your normal post permalink. Existing links to the old URLs may 404 unless you add redirects (Rank Math → Redirections can do this). Content, images, dates, categories, and the assigned author are all preserved. Consider converting a few first and checking before doing the rest.', 'article-duplicator' ); ?>
                </p>
            </div>

            <div class="artdup-panel">
                <h2><?php _e( 'New imports', 'article-duplicator' ); ?></h2>
                <?php if ( $is_post ) : ?>
                    <p><span class="dashicons dashicons-yes" style="color:#057a55;"></span> <?php _e( 'New imports are already set to publish as <strong>Posts</strong>.', 'article-duplicator' ); ?></p>
                <?php else : ?>
                    <form method="post">
                        <?php wp_nonce_field( 'ad_convert' ); ?>
                        <input type="hidden" name="ad_convert_action" value="settings" />
                        <input type="hidden" name="ad_set_default_post" value="1" />
                        <p><?php _e( 'New imports currently publish as <strong>Scraped Articles</strong>.', 'article-duplicator' ); ?></p>
                        <button type="submit" class="button button-primary"><?php _e( 'Make new imports publish as Posts', 'article-duplicator' ); ?></button>
                    </form>
                <?php endif; ?>
            </div>

            <div class="artdup-panel">
                <h2><?php printf( __( 'Existing Scraped Articles: %d remaining', 'article-duplicator' ), $remaining ); ?></h2>
                <?php if ( $remaining < 1 ) : ?>
                    <p><span class="dashicons dashicons-yes" style="color:#057a55;"></span> <?php _e( 'No Scraped Articles left to convert.', 'article-duplicator' ); ?></p>
                <?php else : ?>
                    <p class="description"><?php printf( __( 'Converts up to %d at a time. Click again to continue until none remain.', 'article-duplicator' ), self::BATCH ); ?></p>
                    <form method="post" onsubmit="return confirm('<?php echo esc_js( __( 'Convert the next batch of Scraped Articles to Posts? Their URLs will change.', 'article-duplicator' ) ); ?>');">
                        <?php wp_nonce_field( 'ad_convert' ); ?>
                        <input type="hidden" name="ad_convert_action" value="convert" />
                        <?php if ( ! $is_post ) : ?>
                        <label style="display:block;margin-bottom:8px;">
                            <input type="checkbox" name="ad_set_default_post" value="1" checked />
                            <?php _e( 'Also set new imports to publish as Posts', 'article-duplicator' ); ?>
                        </label>
                        <?php endif; ?>
                        <button type="submit" class="button button-primary"><?php printf( __( 'Convert next %d to Posts', 'article-duplicator' ), min( self::BATCH, $remaining ) ); ?></button>
                    </form>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }
}
