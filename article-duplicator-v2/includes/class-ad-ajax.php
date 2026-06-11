<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_Ajax {

    public function __construct() {
        add_action( 'wp_ajax_ad_preview_articles',  [ $this, 'preview_articles' ] );
        add_action( 'wp_ajax_ad_import_articles',   [ $this, 'import_articles' ] );
        add_action( 'wp_ajax_ad_import_single',     [ $this, 'import_single' ] );
        add_action( 'wp_ajax_ad_clear_logs',        [ $this, 'clear_logs' ] );
        add_action( 'wp_ajax_ad_test_connection',   [ $this, 'test_connection' ] );
    }

    private function verify() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( [ 'message' => __( 'Permission denied.', 'article-duplicator' ) ] );
        }
        check_ajax_referer( 'ad_nonce', 'nonce' );
    }

    /**
     * Preview articles without importing.
     */
    public function preview_articles() {
        $this->verify();

        $scraper  = new AD_Scraper();
        $articles = $scraper->fetch_article_list();

        if ( is_wp_error( $articles ) ) {
            wp_send_json_error( [ 'message' => $articles->get_error_message() ] );
        }

        wp_send_json_success( [ 'articles' => $articles, 'count' => count( $articles ) ] );
    }

    /**
     * Import all scraped articles (bulk).
     */
    public function import_articles() {
        $this->verify();
        set_time_limit( 300 );

        $scraper   = new AD_Scraper();
        $importer  = new AD_Importer();
        $author_id = sanitize_text_field( wp_unslash( $_POST['author_id'] ?? '' ) );

        $articles = $scraper->fetch_article_list();
        if ( is_wp_error( $articles ) ) {
            wp_send_json_error( [ 'message' => $articles->get_error_message() ] );
        }

        $results = [
            'imported' => 0,
            'skipped'  => 0,
            'errors'   => 0,
            'details'  => [],
        ];

        foreach ( $articles as $article ) {

            // Fetch full article content
            $full = $scraper->fetch_article_content( $article['url'] );
            if ( is_wp_error( $full ) ) {
                $results['errors']++;
                $results['details'][] = [
                    'title'   => $article['title'],
                    'url'     => $article['url'],
                    'status'  => 'error',
                    'message' => $full->get_error_message(),
                ];
                continue;
            }

            /*
             * Merge listing data + full content.
             * Priority: full content wins for title/excerpt/date/thumbnail
             * but keep listing title as fallback.
             */
            $data = array_merge( $article, $full );

            // Ensure both url and source keys are set
            $data['url']    = $article['url'];
            $data['source'] = $article['url'];

            // Keep listing card data when the full page omits the same field.
            foreach ( [ 'title', 'excerpt', 'date', 'thumbnail' ] as $field ) {
                if ( empty( $data[ $field ] ) && ! empty( $article[ $field ] ) ) {
                    $data[ $field ] = $article[ $field ];
                }
            }

            $post_id = $importer->import( $data, $author_id );

            if ( is_wp_error( $post_id ) ) {
                if ( $post_id->get_error_code() === 'duplicate' ) {
                    $results['skipped']++;
                    $results['details'][] = [
                        'title'   => $data['title'],
                        'url'     => $article['url'],
                        'status'  => 'skipped',
                        'message' => __( 'Already imported.', 'article-duplicator' ),
                    ];
                } else {
                    $results['errors']++;
                    $results['details'][] = [
                        'title'   => $data['title'],
                        'url'     => $article['url'],
                        'status'  => 'error',
                        'message' => $post_id->get_error_message(),
                    ];
                }
            } else {
                $results['imported']++;
                $results['details'][] = [
                    'title'    => $data['title'],
                    'url'      => $article['url'],
                    'status'   => 'imported',
                    'post_id'  => $post_id,
                    'edit_url' => get_edit_post_link( $post_id, 'raw' ),
                ];
            }

            sleep( 1 ); // polite crawling
        }

        wp_send_json_success( $results );
    }

    /**
     * Import a single article by URL.
     */
    public function import_single() {
        $this->verify();

        $url = esc_url_raw( $_POST['article_url'] ?? '' );
        if ( empty( $url ) ) {
            wp_send_json_error( [ 'message' => __( 'No URL provided.', 'article-duplicator' ) ] );
        }

        $scraper   = new AD_Scraper();
        $importer  = new AD_Importer();
        $author_id = sanitize_text_field( wp_unslash( $_POST['author_id'] ?? '' ) );

        $data = $scraper->fetch_article_content( $url );
        if ( is_wp_error( $data ) ) {
            wp_send_json_error( [ 'message' => $data->get_error_message() ] );
        }

        // Ensure both url and source keys are present
        $data['url']    = $url;
        $data['source'] = $url;

        $post_id = $importer->import( $data, $author_id );

        if ( is_wp_error( $post_id ) ) {
            $code = $post_id->get_error_code();
            if ( $code === 'duplicate' ) {
                $existing_id = $post_id->get_error_data('duplicate')['post_id'] ?? 0;
                wp_send_json_error( [
                    'message'  => __( 'Article already imported.', 'article-duplicator' ),
                    'post_id'  => $existing_id,
                    'edit_url' => $existing_id ? get_edit_post_link( $existing_id, 'raw' ) : '',
                ] );
            }
            wp_send_json_error( [ 'message' => $post_id->get_error_message() ] );
        }

        wp_send_json_success( [
            'post_id'  => $post_id,
            'edit_url' => get_edit_post_link( $post_id, 'raw' ),
            'message'  => __( 'Article imported successfully!', 'article-duplicator' ),
        ] );
    }

    /**
     * Clear import logs.
     */
    public function clear_logs() {
        $this->verify();
        $importer = new AD_Importer();
        $importer->clear_logs();
        wp_send_json_success( [ 'message' => __( 'Logs cleared.', 'article-duplicator' ) ] );
    }

    /**
     * Test connection to source URL.
     */
    public function test_connection() {
        $this->verify();

        $url      = get_option( 'ad_source_url', 'https://www.letrot.com/actualites' );
        $response = wp_remote_get( $url, [
            'timeout'    => 20,
            'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'sslverify'  => false,
        ] );

        if ( is_wp_error( $response ) ) {
            wp_send_json_error( [ 'message' => $response->get_error_message() ] );
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code === 200 ) {
            $body_length = strlen( wp_remote_retrieve_body( $response ) );
            wp_send_json_success( [
                'message' => sprintf(
                    __( 'Connected! HTTP %d — received %s KB', 'article-duplicator' ),
                    $code,
                    round( $body_length / 1024, 1 )
                ),
            ] );
        } else {
            wp_send_json_error( [
                'message' => sprintf( __( 'Received HTTP %d from source.', 'article-duplicator' ), $code ),
            ] );
        }
    }
}
