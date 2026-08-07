<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_Importer {

    private $log_table;

    public function __construct() {
        global $wpdb;
        $this->log_table = $wpdb->prefix . 'ad_import_log';
    }

    /**
     * Import a single scraped article. Returns post_id or WP_Error.
     *
     * Expected keys in $article_data:
     *   url        – canonical source URL (used for duplicate check)
     *   source     – same as url (set by fetch_article_content)
     *   title      – article title
     *   content    – full HTML body
     *   excerpt    – short description
     *   date       – publication date string
     *   thumbnail  – featured image URL
     *   images     – array of inline image URLs
     *
     * $author_override – optional author for this import only: a WP user ID,
     *                    'guest-{id}' for a Molongui guest author, or
     *                    'term-{id}' for a guest author term in the 'author'
     *                    taxonomy (falls back to the saved default).
     */
    public function import( array $article_data, $author_override = '' ) {

        // Normalise: both 'url' and 'source' keys should exist
        if ( empty( $article_data['source'] ) && ! empty( $article_data['url'] ) ) {
            $article_data['source'] = $article_data['url'];
        }
        if ( empty( $article_data['url'] ) && ! empty( $article_data['source'] ) ) {
            $article_data['url'] = $article_data['source'];
        }

        $source_url = $article_data['source'] ?? $article_data['url'] ?? '';

        // ── Duplicate check ──────────────────────────────────────────
        if ( get_option( 'ad_duplicate_check', '1' ) ) {
            $existing = $this->find_existing( $source_url );
            if ( $existing ) {
                $this->log( $source_url, $existing, $article_data['title'] ?? '', 'skipped', 'Duplicate detected.' );
                return new WP_Error( 'duplicate', __( 'Article already imported.', 'article-duplicator' ), [ 'post_id' => $existing ] );
            }
        }

        // ── Prepare post data ─────────────────────────────────────────
        $post_status = get_option( 'ad_post_status', 'draft' );
        $post_type   = get_option( 'ad_post_type',   'ad_article' );
        $prefix      = trim( get_option( 'ad_prefix_title', '' ) );
        $raw_title   = trim( $article_data['title'] ?? '' );
        $title       = $prefix ? trim( $prefix . ' ' . $raw_title ) : $raw_title;

        // Content — require at least something
        $content = trim( $article_data['content'] ?? '' );
        if ( empty( $content ) ) {
            // Fallback: use excerpt as content if content scrape failed
            $content = nl2br( sanitize_textarea_field( $article_data['excerpt'] ?? '' ) );
        }

        // Post date: default to current time so imports surface at the top of
        // the list (and pick up the real publish time when a draft is later
        // published). Only pin to the scraped article date when explicitly
        // chosen — the original date is always kept in _ad_original_date meta.
        $post_date = null;
        if ( 'original' === get_option( 'ad_post_date_mode', 'current' ) && ! empty( $article_data['date'] ) ) {
            $ts = strtotime( $article_data['date'] );
            if ( $ts ) $post_date = date( 'Y-m-d H:i:s', $ts );
        }

        $post_args = [
            'post_title'   => wp_strip_all_tags( $title ),
            'post_content' => wp_kses_post( $content ),
            'post_excerpt' => sanitize_textarea_field( $article_data['excerpt'] ?? '' ),
            'post_status'  => $post_status,
            'post_type'    => $post_type,
            'meta_input'   => [
                '_ad_source_url'    => esc_url_raw( $source_url ),
                '_ad_scraped_date'  => current_time( 'mysql' ),
                '_ad_original_date' => $article_data['date'] ?? '',
                '_ad_original_author' => $article_data['author'] ?? '',
            ],
        ];

        $selection = $this->resolve_author_selection( $author_override );
        $author_id = $selection['user_id'];
        if ( $author_id ) {
            $post_args['post_author'] = $author_id;
        }

        if ( $post_date ) {
            $post_args['post_date']     = $post_date;
            $post_args['post_date_gmt'] = get_gmt_from_date( $post_date );
        }

        $post_id = wp_insert_post( $post_args, true );

        if ( is_wp_error( $post_id ) ) {
            $this->log( $source_url, null, $raw_title, 'error', $post_id->get_error_message() );
            return $post_id;
        }

        // ── Assign guest author / byline ─────────────────────────────
        // A selected author (per-import or Default Author setting) always
        // wins the visible byline. The scraped source byline is kept in
        // _ad_original_author meta and only shown when no author has been
        // selected anywhere.
        $scraped_byline    = $this->resolve_guest_author_name( $article_data['author'] ?? '' );
        $selected_term_id  = 0;
        $selected_guest_id = 0;

        if ( '' !== $selection['name'] ) {
            $guest_author_name = $selection['name'];
            $selected_term_id  = $selection['term_id'];
            $selected_guest_id = $selection['guest_id'];
        } else {
            $guest_author_name = $scraped_byline ?: $this->author_display_name( $author_id );
        }
        $this->assign_guest_author( $post_id, $guest_author_name, $selected_term_id, $selected_guest_id );

        // ── Attach race replay when track + race can be detected ──────
        AD_Replays::maybe_attach_to_import( $post_id, $article_data );

        // ── Assign selected standard WordPress category ──────────────
        $default_cat = get_option( 'ad_default_category', '' );
        if ( ! empty( $default_cat ) && taxonomy_exists( 'category' ) ) {
            wp_set_post_categories( $post_id, [ (int) $default_cat ], true );
        }

        // ── Assign 'Articles' category (standard WP category) ────────
        if ( taxonomy_exists( 'category' ) ) {
            $articles_term = get_term_by( 'name', 'Articles', 'category' );
            if ( ! $articles_term ) {
                // Create it if it doesn't exist yet
                $inserted = wp_insert_term( 'Articles', 'category' );
                $articles_cat_id = is_wp_error( $inserted ) ? 0 : $inserted['term_id'];
            } else {
                $articles_cat_id = $articles_term->term_id;
            }
            if ( $articles_cat_id ) {
                wp_set_post_categories( $post_id, [ $articles_cat_id ], true );
            }
        }

        // ── Assign Country taxonomy based on configured source ────────
        // Supports both 'countries' and 'country' taxonomy slugs.
        $country_taxonomy = taxonomy_exists( 'countries' ) ? 'countries'
                          : ( taxonomy_exists( 'country' ) ? 'country' : '' );

        if ( $country_taxonomy ) {
            $saved_slug   = get_option( 'ad_source_slug', '' );
            $country_term = AD_Sources::country_for_url_or_slug( $source_url, $saved_slug );

            if ( $country_term ) {
                // Ensure the term exists, create it if not
                if ( ! get_term_by( 'name', $country_term, $country_taxonomy ) ) {
                    wp_insert_term( $country_term, $country_taxonomy );
                }
                wp_set_post_terms( $post_id, [ $country_term ], $country_taxonomy, false );
            }
        }

        // ── Page template ─────────────────────────────────────────────
        // Ensures the post renders with the correct front-end template.
        // 'default' uses the theme's standard single post template.
        // Change to e.g. 'single-article.php' if your theme requires it.
        update_post_meta( $post_id, '_wp_page_template', 'default' );

        $imported_image_ids = [];

        // ── Featured image ────────────────────────────────────────────
        if ( get_option( 'ad_import_featured', '1' ) && ! empty( $article_data['thumbnail'] ) && $this->is_importable_image_url( $article_data['thumbnail'] ) ) {
            $attachment_id = $this->set_featured_image( $post_id, $article_data['thumbnail'], $title );
            if ( $attachment_id && ! is_wp_error( $attachment_id ) ) {
                $imported_image_ids[ $article_data['thumbnail'] ] = (int) $attachment_id;
            }
        }

        // ── Inline images ─────────────────────────────────────────────
        if ( get_option( 'ad_import_images', '1' ) ) {
            $image_urls = array_values( array_unique( array_filter( array_merge(
                ! empty( $article_data['thumbnail'] ) ? [ $article_data['thumbnail'] ] : [],
                $article_data['images'] ?? []
            ) ) ) );

            foreach ( $image_urls as $img_url ) {
                if ( ! $this->is_importable_image_url( $img_url ) ) {
                    continue;
                }

                if ( isset( $imported_image_ids[ $img_url ] ) ) {
                    continue;
                }

                $attachment_id = $this->sideload_image( $post_id, $img_url, $title );
                if ( $attachment_id && ! is_wp_error( $attachment_id ) ) {
                    $imported_image_ids[ $img_url ] = (int) $attachment_id;
                }
            }
        }

        if ( ! empty( $imported_image_ids ) ) {
            $this->hard_embed_imported_images( $post_id, $imported_image_ids );
        }

        $this->log( $source_url, $post_id, $raw_title, 'success', 'Imported successfully.' );

        return $post_id;
    }

    /**
     * Check if a source URL was already imported.
     * Checks both the log table and the _ad_source_url post meta.
     */
    private function find_existing( $source_url ) {
        if ( empty( $source_url ) ) return false;

        global $wpdb;

        // 1. Check log table for a successful import of this URL
        $post_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT post_id FROM {$this->log_table} WHERE source_url = %s AND status = 'success' LIMIT 1",
            $source_url
        ) );
        if ( $post_id && get_post( (int) $post_id ) ) {
            return (int) $post_id;
        }

        // 2. Check post meta directly (covers imports done before logging was enabled)
        $meta_post_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key='_ad_source_url' AND meta_value=%s LIMIT 1",
            $source_url
        ) );
        if ( $meta_post_id && get_post( (int) $meta_post_id ) ) {
            return (int) $meta_post_id;
        }

        return false;
    }

    /**
     * Resolve who imported articles are credited to.
     *
     * Accepts a WP user ID, 'guest-{id}' referencing a Molongui guest_author
     * post, or 'term-{id}' referencing a guest author term in the 'author'
     * taxonomy. Priority: per-import override → 'ad_default_author' setting
     * → legacy shared 'harnesslink' account.
     *
     * Returns [ 'user_id', 'guest_id', 'term_id', 'name' ]. Selections
     * without a linked WP user fall back to the legacy account for post
     * ownership while keeping the selection as the byline.
     */
    private function resolve_author_selection( $override = '' ) {
        foreach ( [ $override, get_option( 'ad_default_author', '' ) ] as $value ) {
            $parsed = $this->parse_author_value( $value );
            if ( $parsed ) {
                if ( empty( $parsed['user_id'] ) ) {
                    $parsed['user_id'] = $this->get_harnesslink_author_id();
                }
                return $parsed;
            }
        }

        return [ 'user_id' => $this->get_harnesslink_author_id(), 'guest_id' => 0, 'term_id' => 0, 'name' => '' ];
    }

    /**
     * Parse a single author selection value (user ID, 'guest-{id}' or 'term-{id}').
     */
    private function parse_author_value( $value ) {
        $value = trim( (string) $value );

        if ( preg_match( '/^guest-(\d+)$/', $value, $m ) && post_type_exists( 'guest_author' ) ) {
            $guest = get_post( (int) $m[1] );
            if ( $guest && 'guest_author' === $guest->post_type ) {
                $name = get_post_meta( $guest->ID, '_molongui_guest_author_display_name', true ) ?: get_the_title( $guest );
                return [
                    'user_id'  => 0,
                    'guest_id' => (int) $guest->ID,
                    'term_id'  => 0,
                    'name'     => $name,
                ];
            }
            return null;
        }

        if ( preg_match( '/^term-(\d+)$/', $value, $m ) && taxonomy_exists( 'author' ) ) {
            $term = get_term( (int) $m[1], 'author' );
            if ( $term && ! is_wp_error( $term ) ) {
                return [
                    'user_id'  => absint( get_term_meta( $term->term_id, 'user_id', true ) ),
                    'guest_id' => 0,
                    'term_id'  => (int) $term->term_id,
                    'name'     => $term->name,
                ];
            }
            return null;
        }

        $user_id = absint( $value );
        if ( $user_id ) {
            $user = get_user_by( 'ID', $user_id );
            if ( $user ) {
                return [ 'user_id' => $user_id, 'guest_id' => 0, 'term_id' => 0, 'name' => $user->display_name ];
            }
        }

        return null;
    }

    /**
     * Public: apply an author selection to an existing post (used by the
     * editor "Published By" box). Accepts a WP user ID, 'guest-{id}',
     * 'term-{id}', or '' to clear. Writes the byline meta AND the real
     * Molongui pointer so the selected author actually displays, and sets
     * the post's WP owner to the linked/fallback user. Returns the resolved
     * display name ('' when cleared).
     */
    public function apply_author_selection( $post_id, $value ) {
        $value = trim( (string) $value );

        if ( '' === $value ) {
            delete_post_meta( $post_id, '_ad_guest_author' );
            delete_post_meta( $post_id, 'guest_author' );
            delete_post_meta( $post_id, '_molongui_main_author' );
            delete_post_meta( $post_id, '_molongui_author' );
            return '';
        }

        $parsed = $this->parse_author_value( $value );
        if ( ! $parsed ) {
            return '';
        }

        // Clear any stale Molongui pointer so a re-selection fully replaces
        // the previous author rather than layering on top of it.
        delete_post_meta( $post_id, '_molongui_main_author' );
        delete_post_meta( $post_id, '_molongui_author' );

        $this->assign_guest_author( $post_id, $parsed['name'], $parsed['term_id'], $parsed['guest_id'] );

        return $parsed['name'];
    }

    /**
     * Display name of a user, used as the byline fallback.
     */
    private function author_display_name( $author_id ) {
        $user = $author_id ? get_user_by( 'ID', absint( $author_id ) ) : false;
        if ( $user && $user->display_name ) {
            return $user->display_name;
        }
        return 'Harnesslink';
    }

    /**
     * Resolve the shared Harnesslink author account for imported articles.
     */
    private function get_harnesslink_author_id() {
        $user = get_user_by( 'login', 'harnesslink' );
        if ( ! $user ) {
            $user = get_user_by( 'slug', 'harnesslink' );
        }
        if ( $user ) {
            return (int) $user->ID;
        }

        $users = get_users( [
            'search'         => 'harnesslink',
            'search_columns' => [ 'user_login', 'user_nicename', 'display_name' ],
            'number'         => 1,
            'fields'         => 'ID',
        ] );

        return ! empty( $users ) ? (int) $users[0] : 0;
    }

    /**
     * Clean source bylines. Returns '' when no usable byline was scraped
     * so the caller can substitute the selected author's display name.
     */
    private function resolve_guest_author_name( $raw_author ) {
        $author = html_entity_decode( wp_strip_all_tags( (string) $raw_author ), ENT_QUOTES, get_bloginfo( 'charset' ) );
        $author = preg_replace( '/\s+/', ' ', trim( $author ) );
        // Strip common byline lead-ins. Longer phrases are listed first so
        // they win the leftmost match before the short "by"/"from" tokens.
        // "from" is included because source pages often render "from {Track}",
        // which previously leaked through as a junk "from …" author name.
        $author = preg_replace( '/^(written by|published by|reported by|story by|words by|posted by|by|author|from(?: the)?)\s*[:\-]?\s*/i', '', $author );
        $author = preg_replace( '/\s+(on|:)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).*$/i', '', $author );
        $author = preg_replace( '/\s+(on|:)\s*$/i', '', $author );
        $author = trim( $author, " \t\n\r\0\x0B:-" );

        if ( empty( $author ) || mb_strlen( $author ) < 2 ) {
            return '';
        }

        return mb_substr( $author, 0, 120 );
    }

    /**
     * Assign a guest-author style byline when a compatible taxonomy exists.
     *
     * Supports the common "author" taxonomy used by guest-author plugins while
     * retaining meta fallbacks for themes or plugins that read imported bylines.
     */
    private function assign_guest_author( $post_id, $author_name, $selected_term_id = 0, $selected_guest_id = 0 ) {
        if ( empty( $author_name ) ) {
            $parsed      = $this->parse_author_value( get_option( 'ad_default_author', '' ) );
            $author_name = ( $parsed['name'] ?? '' ) ?: 'Harnesslink';
        }

        update_post_meta( $post_id, '_ad_guest_author', $author_name );
        update_post_meta( $post_id, 'guest_author', $author_name );

        // Editor-selected guest author term: assign it as-is and leave its
        // existing term meta untouched.
        if ( $selected_term_id && taxonomy_exists( 'author' ) ) {
            wp_set_post_terms( $post_id, [ (int) $selected_term_id ], 'author', false );
        }

        // ONE byline only. Molongui ships two products that each render a
        // "Written by …" line: Authorship (the _molongui_main_author pointer)
        // and Post Contributors (the mpb-* role taxonomy). Assigning both
        // produced a DUPLICATE byline on the front end — and the Post
        // Contributors copy is also what surfaced stale "from …" junk names.
        // We standardise on Authorship as the single byline and strip any
        // Post Contributors terms so only one line ever renders.
        $this->clear_molongui_post_contributors( $post_id );

        // Editor-selected Molongui guest author: link the exact entry rather
        // than matching by name.
        $assigned_molongui_author = $this->assign_molongui_guest_author( $post_id, $author_name, $selected_guest_id );

        if ( $assigned_molongui_author ) {
            return;
        }

        if ( ! $selected_term_id ) {
            $this->assign_guest_author_taxonomy_terms( $post_id, $author_name );
        }
        $this->assign_coauthors_plus_guest_author( $post_id, $author_name );
    }

    /**
     * Native Molongui Authorship support.
     *
     * Molongui stores guest authors as the guest_author CPT and links posts via:
     *   _molongui_main_author = guest-{guest_author_post_id}
     *   _molongui_author      = guest-{guest_author_post_id}
     */
    private function assign_molongui_guest_author( $post_id, $author_name, $guest_id = 0 ) {
        if ( ! post_type_exists( 'guest_author' ) ) {
            return false;
        }

        if ( ! $guest_id || 'guest_author' !== get_post_type( $guest_id ) ) {
            $guest_id = $this->find_molongui_guest_author( $author_name );
        }
        if ( ! $guest_id ) {
            return false;
        }

        $author_ref = 'guest-' . $guest_id;

        update_post_meta( $post_id, '_molongui_main_author', $author_ref );
        delete_post_meta( $post_id, '_molongui_author' );
        add_post_meta( $post_id, '_molongui_author', $author_ref, false );

        return true;
    }

    /**
     * Find an existing Molongui guest_author CPT entry by name.
     *
     * Lookup only — entries are deliberately never created from scraped
     * bylines, which used to flood the Guest Authors screen with junk.
     */
    private function find_molongui_guest_author( $author_name ) {
        $author_name = trim( (string) $author_name );
        if ( '' === $author_name ) {
            return 0;
        }
        $slug = sanitize_title( $author_name );

        $existing = get_posts( [
            'post_type'      => 'guest_author',
            'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
            'name'           => $slug,
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ] );

        if ( empty( $existing ) ) {
            $existing = get_posts( [
                'post_type'      => 'guest_author',
                'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
                'meta_key'       => '_molongui_guest_author_display_name',
                'meta_value'     => $author_name,
                'posts_per_page' => 1,
                'fields'         => 'ids',
            ] );
        }

        return ! empty( $existing ) ? (int) $existing[0] : 0;
    }

    /**
     * Remove any Molongui Post Contributors role terms (mpb-*) from a post.
     *
     * Post Contributors renders its own "Written by …" byline on top of the
     * one Molongui Authorship already renders, so leaving these terms in place
     * produces a duplicate byline (and is where older imports' "from …" junk
     * names showed up). Authorship's main-author pointer is the single source
     * of truth for the byline, so we strip the contributor terms here — both
     * on fresh imports and whenever an author is (re)selected in the editor.
     */
    private function clear_molongui_post_contributors( $post_id ) {
        foreach ( get_object_taxonomies( get_post_type( $post_id ) ?: 'post' ) as $taxonomy ) {
            if ( strpos( $taxonomy, 'mpb-' ) !== 0 ) {
                continue;
            }
            wp_set_post_terms( $post_id, [], $taxonomy, false );
        }
        // Also clear any mpb-* taxonomy not currently attached to this post
        // type (Post Contributors registers them lazily), to be thorough.
        foreach ( get_taxonomies() as $taxonomy ) {
            if ( strpos( $taxonomy, 'mpb-' ) !== 0 ) {
                continue;
            }
            wp_remove_object_terms( $post_id, wp_get_object_terms( $post_id, $taxonomy, [ 'fields' => 'ids' ] ), $taxonomy );
        }
        clean_object_term_cache( $post_id, get_post_type( $post_id ) ?: 'post' );
    }

    /**
     * Create and assign a guest-author term when the site exposes one.
     */
    private function assign_guest_author_taxonomy_terms( $post_id, $author_name ) {
        foreach ( [ 'author', 'authors', 'guest_author', 'guest-author' ] as $taxonomy ) {
            if ( ! taxonomy_exists( $taxonomy ) ) continue;

            $term = get_term_by( 'name', $author_name, $taxonomy );
            if ( ! $term ) {
                $inserted = wp_insert_term( $author_name, $taxonomy, [
                    'slug' => sanitize_title( $author_name ),
                ] );
                if ( is_wp_error( $inserted ) ) continue;
                $term_id = (int) $inserted['term_id'];
            } else {
                $term_id = (int) $term->term_id;
            }

            if ( $term_id ) {
                update_term_meta( $term_id, 'display_name', $author_name );
                update_term_meta( $term_id, 'first_name', $author_name );
                update_term_meta( $term_id, 'user_id', 0 );
                update_term_meta( $term_id, 'author_type', 'guest' );
                update_term_meta( $term_id, 'ppma_author_type', 'guest' );
                wp_set_post_terms( $post_id, [ $term_id ], $taxonomy, false );
            }
        }
    }

    /**
     * Co-Authors Plus stores guest authors behind its own API; taxonomy/meta
     * assignment alone will not populate its editor box.
     */
    private function assign_coauthors_plus_guest_author( $post_id, $author_name ) {
        global $coauthors_plus;

        if ( empty( $coauthors_plus ) || ! method_exists( $coauthors_plus, 'assign_authors' ) ) {
            return false;
        }

        $author_slug = sanitize_title( $author_name );
        $author_ref  = $author_slug ?: 'harnesslink';

        if ( ! empty( $coauthors_plus->guest_authors ) ) {
            $guest_authors = $coauthors_plus->guest_authors;
            $guest_author  = null;

            if ( method_exists( $guest_authors, 'get_guest_author_by' ) ) {
                $guest_author = $guest_authors->get_guest_author_by( 'user_login', $author_ref );
                if ( ! $guest_author ) {
                    $guest_author = $guest_authors->get_guest_author_by( 'display_name', $author_name );
                }
            }

            if ( ! $guest_author && method_exists( $guest_authors, 'create' ) ) {
                $created = $guest_authors->create( [
                    'display_name'  => $author_name,
                    'user_login'    => $author_ref,
                    'user_nicename' => $author_ref,
                ] );

                if ( ! is_wp_error( $created ) && method_exists( $guest_authors, 'get_guest_author_by' ) ) {
                    $guest_author = $guest_authors->get_guest_author_by( 'user_login', $author_ref );
                }
            }

            if ( is_object( $guest_author ) && ! empty( $guest_author->user_login ) ) {
                $author_ref = $guest_author->user_login;
            } elseif ( is_array( $guest_author ) && ! empty( $guest_author['user_login'] ) ) {
                $author_ref = $guest_author['user_login'];
            }
        }

        $coauthors_plus->assign_authors( $post_id, [ $author_ref ], false );
        return true;
    }

    /**
     * Sideload and set featured image.
     */
    public function set_featured_image( $post_id, $image_url, $desc = '' ) {
        $attachment_id = $this->sideload_image( $post_id, $image_url, $desc );
        if ( $attachment_id && ! is_wp_error( $attachment_id ) ) {
            set_post_thumbnail( $post_id, $attachment_id );
        }
        return $attachment_id;
    }

    /**
     * Sideload a remote image into the WP media library.
     */
    private function sideload_image( $post_id, $image_url, $desc = '' ) {
        if ( empty( $image_url ) ) return false;
        if ( ! $this->is_importable_image_url( $image_url ) ) return false;

        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $tmp = download_url( $image_url, 30 );
        if ( is_wp_error( $tmp ) ) return $tmp;

        $file_array = [
            'name'     => basename( parse_url( $image_url, PHP_URL_PATH ) ) ?: 'image.jpg',
            'tmp_name' => $tmp,
        ];

        $id = media_handle_sideload( $file_array, $post_id, $desc );
        @unlink( $tmp );

        return $id;
    }

    /**
     * Make imported images visible inside the editor, not just attached in Media.
     *
     * If the scraped content already contains the remote URL, replace it with the
     * local Media Library URL. If not, append a WordPress image figure so drafts
     * still contain the loaded image.
     */
    private function hard_embed_imported_images( $post_id, array $image_map ) {
        $post = get_post( $post_id );
        if ( ! $post ) {
            return;
        }

        $content = (string) $post->post_content;
        $append  = [];

        foreach ( $image_map as $source_url => $attachment_id ) {
            $attachment_id = (int) $attachment_id;
            $local_url     = wp_get_attachment_url( $attachment_id );

            if ( ! $attachment_id || ! $local_url ) {
                continue;
            }

            $content = $this->replace_image_url_variants( $content, $source_url, $local_url );

            if ( $this->content_has_imported_image( $content, $source_url, $local_url, $attachment_id ) ) {
                continue;
            }

            $image_html = $this->build_imported_image_html( $attachment_id );
            if ( $image_html ) {
                $append[] = $image_html;
            }
        }

        if ( ! empty( $append ) ) {
            $content = trim( $content );
            $content .= ( $content ? "\n\n" : '' ) . implode( "\n\n", $append );
        }

        wp_update_post( [
            'ID'           => $post_id,
            'post_content' => wp_kses_post( $content ),
        ] );
    }

    private function replace_image_url_variants( $content, $source_url, $local_url ) {
        $source_url = (string) $source_url;
        $local_url  = esc_url_raw( $local_url );

        foreach ( array_unique( [
            $source_url,
            esc_url( $source_url ),
            esc_attr( $source_url ),
            str_replace( '&', '&amp;', $source_url ),
        ] ) as $variant ) {
            if ( $variant !== '' ) {
                $content = str_replace( $variant, $local_url, $content );
            }
        }

        return $content;
    }

    private function content_has_imported_image( $content, $source_url, $local_url, $attachment_id ) {
        return false !== strpos( $content, 'wp-image-' . (int) $attachment_id )
            || false !== strpos( $content, (string) $local_url )
            || false !== strpos( $content, (string) $source_url );
    }

    private function build_imported_image_html( $attachment_id ) {
        $img = wp_get_attachment_image( $attachment_id, 'large', false, [
            'class'   => 'wp-image-' . (int) $attachment_id,
            'loading' => 'lazy',
        ] );

        if ( ! $img ) {
            $url = wp_get_attachment_url( $attachment_id );
            if ( ! $url ) {
                return '';
            }
            $img = '<img src="' . esc_url( $url ) . '" alt="" class="wp-image-' . (int) $attachment_id . '" loading="lazy" />';
        }

        return '<figure class="wp-block-image size-large">' . $img . '</figure>';
    }

    /**
     * Refuse social/logo/icon assets before they enter the media library.
     */
    private function is_importable_image_url( $url ) {
        if ( empty( $url ) || strpos( $url, 'data:' ) === 0 ) return false;

        $path = strtolower( parse_url( $url, PHP_URL_PATH ) ?? '' );
        if ( empty( $path ) ) return false;

        $ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
        if ( in_array( $ext, [ 'svg', 'ico', 'gif' ], true ) ) return false;
        if ( $ext && ! in_array( $ext, [ 'jpg', 'jpeg', 'png', 'webp' ], true ) ) return false;

        if ( preg_match( '#/(social|share|shares|icons?|logo|logos|avatar|avatars|emoji|sprite|tracking|analytics|fontawesome)(/|$)#i', $path ) ) {
            return false;
        }

        $base = strtolower( pathinfo( $path, PATHINFO_FILENAME ) );
        if ( preg_match( '/^(facebook|fb|twitter|x-twitter|instagram|linkedin|youtube|email|print|share|search|logo|favicon|icon)$/i', $base ) ) {
            return false;
        }

        return true;
    }

    /**
     * Log an import action to DB.
     */
    private function log( $url, $post_id, $title, $status, $message = '' ) {
        if ( ! get_option( 'ad_log_enabled', '1' ) ) return;
        global $wpdb;
        $wpdb->insert( $this->log_table, [
            'source_url'  => $url,
            'post_id'     => $post_id,
            'post_title'  => $title,
            'status'      => $status,
            'message'     => $message,
            'imported_at' => current_time( 'mysql' ),
        ], [ '%s', '%d', '%s', '%s', '%s', '%s' ] );
    }

    /**
     * Get import logs.
     */
    public function get_logs( $limit = 50 ) {
        global $wpdb;
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$this->log_table} ORDER BY imported_at DESC LIMIT %d",
            $limit
        ) );
    }

    /**
     * Clear all logs.
     */
    public function clear_logs() {
        global $wpdb;
        $wpdb->query( "TRUNCATE TABLE {$this->log_table}" );
    }
}
