<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLD_Ajax {

    public static function init() {
        // Public actions
        add_action( 'wp_ajax_nopriv_hld_search',          array( __CLASS__, 'search' ) );
        add_action( 'wp_ajax_hld_search',                 array( __CLASS__, 'search' ) );
        add_action( 'wp_ajax_nopriv_hld_submit_enquiry',  array( __CLASS__, 'submit_enquiry' ) );
        add_action( 'wp_ajax_hld_submit_enquiry',         array( __CLASS__, 'submit_enquiry' ) );

        // Admin-only actions
        add_action( 'wp_ajax_hld_save_stallion',          array( __CLASS__, 'save_stallion' ) );
        add_action( 'wp_ajax_hld_delete_stallion',        array( __CLASS__, 'delete_stallion' ) );
        add_action( 'wp_ajax_hld_import_csv',             array( __CLASS__, 'import_csv' ) );
        add_action( 'admin_post_hld_export_csv',          array( __CLASS__, 'export_csv' ) );
        add_action( 'wp_ajax_hld_get_stallion',           array( __CLASS__, 'get_stallion' ) );
        add_action( 'wp_ajax_hld_update_enquiry_status',  array( __CLASS__, 'update_enquiry_status' ) );
        add_action( 'wp_ajax_hld_delete_enquiry',         array( __CLASS__, 'delete_enquiry' ) );
        add_action( 'wp_ajax_hld_get_enquiry',            array( __CLASS__, 'get_enquiry' ) );
        // Gallery
        add_action( 'wp_ajax_hld_get_gallery',            array( __CLASS__, 'get_gallery' ) );
        add_action( 'wp_ajax_hld_add_gallery_item',       array( __CLASS__, 'add_gallery_item' ) );
        add_action( 'wp_ajax_hld_delete_gallery_item',    array( __CLASS__, 'delete_gallery_item' ) );
        add_action( 'wp_ajax_hld_reorder_gallery',        array( __CLASS__, 'reorder_gallery' ) );
        add_action( 'wp_ajax_hld_update_gallery_caption', array( __CLASS__, 'update_gallery_caption' ) );
    }

    /* ── Public: live search / filter ── */
    public static function search() {
        check_ajax_referer( 'hld_nonce', 'nonce' );

        $directory_type = HLD_Types::resolve( $_POST['directory_type'] ?? '' );

        $letter = strtoupper( sanitize_text_field( $_POST['letter'] ?? '' ) );
        if ( $letter !== '' && $letter !== '#' && ! preg_match( '/^[A-Z]$/', $letter ) ) {
            $letter = '';
        }

        $args = array(
            'directory_type' => $directory_type,
            'search'   => sanitize_text_field( $_POST['search']  ?? '' ),
            'country'  => sanitize_text_field( $_POST['country'] ?? '' ),
            'type'     => sanitize_text_field( $_POST['type']    ?? '' ),
            'region'   => sanitize_text_field( $_POST['region']  ?? '' ),
            'letter'   => $letter,
            'page'     => absint( $_POST['page'] ?? 1 ),
            'per_page' => HLD_DB::clamp_per_page( $_POST['per_page'] ?? 20 ),
        );

        $result   = HLD_DB::get_listings( $args );
        $hld_type = HLD_Types::get( $directory_type );

        ob_start();
        foreach ( $result['items'] as $listing ) {
            include HLD_PLUGIN_DIR . 'templates/partials/listing-row.php';
        }
        $rows_html = ob_get_clean();

        wp_send_json_success( array(
            'html'     => $rows_html,
            'total'    => $result['total'],
            'pages'    => $result['pages'],
            'page'     => $result['page'],
            'per_page' => $result['per_page'],
        ) );
    }

    /* ── Admin: save (insert or update) ── */
    public static function save_stallion() {
        global $wpdb;

        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        HLD_DB::ensure_columns();

        $id   = absint( $_POST['id'] ?? 0 );
        // WordPress slash-escapes all superglobals; strip that before saving
        // so apostrophes (e.g. "Bettor's Delight") don't accumulate backslashes.
        $data = wp_unslash( $_POST ); // sanitized inside HLD_DB::sanitize()
        $data['is_paying'] = ! empty( $_POST['is_paying'] ) && in_array( (string) $_POST['is_paying'], array( '1', 'true', 'yes', 'on' ), true ) ? 1 : 0;
        $data['is_featured'] = ! empty( $_POST['is_featured'] ) && in_array( (string) $_POST['is_featured'], array( '1', 'true', 'yes', 'on' ), true ) ? 1 : 0;
        if ( $data['is_featured'] ) {
            $data['is_paying'] = 1;
        }
        if ( $data['is_featured'] && ! HLD_DB::has_column( 'is_featured' ) ) {
            wp_send_json_error( 'Featured Stud database field is missing. Reload this admin page and try again.' );
        }

        if ( $id ) {
            if ( ! HLD_DB::get_stallion( $id ) ) {
                wp_send_json_error( 'Stallion not found. Refresh the page and try again.' );
            }

            $result = HLD_DB::update_stallion( $id, $data );
            if ( $result === false ) {
                wp_send_json_error( 'Database update failed: ' . ( $wpdb->last_error ?: 'Unknown database error' ) );
            }

            wp_send_json_success( array(
                'message' => 'Stallion updated.',
                'id'      => $id,
                'stallion'=> HLD_DB::get_stallion( $id ),
            ) );
        } else {
            $new_id = HLD_DB::insert_stallion( $data );
            if ( ! $new_id ) {
                wp_send_json_error( 'Database insert failed: ' . ( $wpdb->last_error ?: 'Unknown database error' ) );
            }

            wp_send_json_success( array(
                'message' => 'Stallion added.',
                'id'      => $new_id,
                'stallion'=> HLD_DB::get_stallion( $new_id ),
            ) );
        }
    }

    /* ── Admin: delete ── */
    public static function delete_stallion() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );

        $id = absint( $_POST['id'] ?? 0 );
        HLD_DB::delete_stallion( $id );
        wp_send_json_success( array( 'message' => 'Stallion deleted.' ) );
    }

    /* ── Admin: get single for edit modal ── */
    public static function get_stallion() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );

        $id = absint( $_POST['id'] ?? 0 );
        $s  = HLD_DB::get_stallion( $id );
        if ( ! $s ) wp_send_json_error( 'Not found' );
        wp_send_json_success( $s );
    }

    /* ── Admin: CSV import ── */
    public static function import_csv() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        HLD_DB::ensure_columns();

        if ( empty( $_FILES['csv_file'] ) ) {
            wp_send_json_error( 'No file uploaded.' );
        }

        $directory_type = HLD_Types::resolve( $_POST['directory_type'] ?? '' );

        $replace_all = ! empty( $_POST['replace_all'] ) && (string) $_POST['replace_all'] === '1';
        if ( $replace_all ) {
            // Only clears the category being imported — other categories are safe.
            HLD_DB::clear_stallions( $directory_type );
        }

        $file = $_FILES['csv_file']['tmp_name'];
        if ( ! is_readable( $file ) ) {
            wp_send_json_error( 'File not readable.' );
        }

        $handle  = fopen( $file, 'r' );
        $headers = fgetcsv( $handle ); // first row = headers
        if ( empty( $headers ) ) {
            wp_send_json_error( 'CSV header row is missing.' );
        }
        $headers = array_map( function( $header ) {
            $header = preg_replace( '/^\xEF\xBB\xBF/', '', (string) $header );
            $header = strtolower( trim( $header ) );
            return str_replace( array( ' ', '-' ), '_', $header );
        }, $headers );

        $inserted           = 0;
        $updated            = 0;
        $errors             = 0;
        $duplicates_removed = 0;

        while ( ( $row = fgetcsv( $handle ) ) !== false ) {
            if ( ! array_filter( $row, 'strlen' ) ) continue;

            if ( count( $row ) < count( $headers ) ) {
                $row = array_pad( $row, count( $headers ), '' );
            } elseif ( count( $row ) > count( $headers ) ) {
                $row = array_slice( $row, 0, count( $headers ) );
            }

            $data = array_combine( $headers, $row );

            $country = self::normalise_import_country( $data['country'] ?? '' );
            $gait    = self::normalise_import_gait( $data['type'] ?? $data['gait'] ?? 'Pacer' );
            $paid    = $data['is_paying'] ?? $data['paid'] ?? $data['paying'] ?? '';
            $featured = $data['is_featured'] ?? $data['featured'] ?? $data['featured_stud'] ?? $data['featured_listing'] ?? '';
            $is_featured = ! empty( $featured ) && in_array( strtolower( $featured ), array('1','yes','true','y','featured') ) ? 1 : 0;
            $is_paying = $is_featured || ( ! empty( $paid ) && in_array( strtolower( $paid ), array('1','yes','true','y','paid') ) ) ? 1 : 0;

            /* map CSV columns -> DB columns */
            $record = array(
                'directory_type'  => $directory_type,
                'name'            => $data['name']            ?? $data['stallion'] ?? $data['business'] ?? $data['business_name'] ?? '',
                'stud_name'       => $data['stud']            ?? $data['stud_name'] ?? $data['organisation'] ?? $data['organization'] ?? $data['company'] ?? $data['stable'] ?? '',
                'country'         => $country,
                'region'          => $data['region']          ?? $data['state'] ?? '',
                'stud_master'     => $data['stud_master']     ?? $data['studmaster'] ?? '',
                'type'            => $gait,
                'status_note'     => $data['status_note']     ?? $data['status'] ?? '',
                'is_paying'       => $is_paying,
                'is_featured'     => $is_featured,
                'contact_phone'   => $data['phone']           ?? $data['contact_phone'] ?? '',
                'contact_email'   => $data['email']           ?? $data['contact_email'] ?? '',
                'contact_website' => $data['stallion_page']   ?? $data['stallion_page_url'] ?? $data['website'] ?? $data['contact_website'] ?? '',
                'stud_website'    => $data['stud_website']    ?? '',
                'contact_au'      => $data['contact_au']      ?? $data['au_contact'] ?? '',
                'contact_us'      => $data['contact_us']      ?? $data['us_contact'] ?? '',
                'contact_nz'      => $data['contact_nz']      ?? $data['nz_contact'] ?? '',
                'contact_fr'      => $data['contact_fr']      ?? $data['fr_contact'] ?? '',
                'contact_other'   => $data['contact_other']   ?? $data['other_contact'] ?? '',
                'contact_address' => $data['address']         ?? $data['contact_address'] ?? '',
                'suburb'          => $data['suburb']          ?? $data['town'] ?? $data['city'] ?? '',
                'industry'        => $data['industry']        ?? $data['industry_involvement'] ?? $data['involvement'] ?? '',
                'coverage'        => $data['coverage']        ?? $data['routes'] ?? $data['routes_travelled'] ?? $data['locations_covered'] ?? $data['delivery_locations'] ?? '',
                'profile_bio'     => $data['bio']             ?? $data['profile_bio'] ?? '',
                'profile_image'   => $data['profile_picture'] ?? $data['profile_image'] ?? $data['profile_pic'] ?? '',
                'race_record'     => $data['race_record']     ?? '',
                'progeny_note'    => $data['progeny_note']    ?? $data['progeny'] ?? '',
            );

            if ( empty( $record['name'] ) ) { $errors++; continue; }

            $result = HLD_DB::replace_stallion_by_name( $record );
            if ( empty( $result['id'] ) ) {
                $errors++;
                continue;
            }

            if ( ! empty( $result['created'] ) ) $inserted++;
            else $updated++;

            $duplicates_removed += absint( $result['duplicates_removed'] ?? 0 );
        }

        fclose( $handle );

        wp_send_json_success( array(
            'inserted' => $inserted,
            'updated'  => $updated,
            'errors'   => $errors,
            'duplicates_removed' => $duplicates_removed,
            'message'  => "Import complete. {$inserted} added, {$updated} updated, {$duplicates_removed} duplicate rows removed, {$errors} skipped." . ( $replace_all ? ' Existing stallions were cleared first.' : '' ),
        ) );
    }

    /* ── Admin: export listings to CSV (re-importable format) ── */
    public static function export_csv() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized', 'Unauthorized', array( 'response' => 403 ) );
        }
        check_admin_referer( 'hld_export_csv' );

        global $wpdb;
        $table          = $wpdb->prefix . 'hld_stallions';
        $directory_type = isset( $_GET['dtype'] ) ? HLD_Types::resolve( $_GET['dtype'] ) : '';

        if ( $directory_type !== '' && HLD_DB::has_column( 'directory_type' ) ) {
            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT * FROM {$table} WHERE directory_type = %s ORDER BY name ASC",
                $directory_type
            ), ARRAY_A );
        } else {
            $rows = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY name ASC", ARRAY_A );
        }

        // Header row uses the human-friendly column names the importer accepts.
        $columns = array(
            'directory_type' => 'Directory Type',
            'name'           => 'Stallion',
            'stud_name'      => 'Stud',
            'country'        => 'Country',
            'region'         => 'Region',
            'suburb'         => 'Suburb',
            'stud_master'    => 'Stud Master',
            'industry'       => 'Industry',
            'type'           => 'Gait',
            'status_note'    => 'Status Note',
            'is_paying'      => 'Paid',
            'is_featured'    => 'Featured Stud',
            'contact_phone'  => 'Phone',
            'contact_email'  => 'Email',
            'contact_website'=> 'Stallion Page',
            'stud_website'   => 'Stud Website',
            'coverage'       => 'Coverage',
            'contact_au'     => 'AU Contact',
            'contact_nz'     => 'NZ Contact',
            'contact_us'     => 'US Contact',
            'contact_fr'     => 'FR Contact',
            'contact_other'  => 'Other Contact',
            'contact_address'=> 'Address',
            'profile_image'  => 'Profile Picture',
            'profile_bio'    => 'Bio',
            'race_record'    => 'Race Record',
            'progeny_note'   => 'Progeny',
        );

        $slug     = $directory_type ?: 'all';
        $date     = gmdate( 'Y-m-d' );
        $filename = "harnesslink-{$slug}-export-{$date}.csv";

        nocache_headers();
        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename=' . $filename );

        $out = fopen( 'php://output', 'w' );
        // UTF-8 BOM so Excel opens accented characters correctly.
        fwrite( $out, "\xEF\xBB\xBF" );

        fputcsv( $out, array_values( $columns ) );

        foreach ( (array) $rows as $row ) {
            $line = array();
            foreach ( array_keys( $columns ) as $key ) {
                $val = $row[ $key ] ?? '';
                if ( $key === 'is_paying' || $key === 'is_featured' ) {
                    $val = ! empty( $val ) ? 'yes' : '';
                }
                $line[] = $val;
            }
            fputcsv( $out, $line );
        }

        fclose( $out );
        exit;
    }

    private static function normalise_import_country( $country ) {
        $parts = preg_split( '/\s*(?:\/|,|\+|&|\band\b)\s*/i', (string) $country );
        $labels = array();

        foreach ( $parts as $part ) {
            $token = strtoupper( trim( $part ) );
            if ( $token === '' ) continue;

            if ( in_array( $token, array( 'AU', 'AUS', 'AUSTRALIA' ), true ) ) {
                $labels[] = 'Australia';
            } elseif ( in_array( $token, array( 'NZ', 'NEW ZEALAND' ), true ) ) {
                $labels[] = 'New Zealand';
            } elseif ( in_array( $token, array( 'US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA' ), true ) ) {
                $labels[] = 'USA';
            } elseif ( in_array( $token, array( 'FR', 'FRA', 'FRANCE' ), true ) ) {
                $labels[] = 'France';
            } else {
                $labels[] = sanitize_text_field( trim( $part ) );
            }
        }

        $labels = array_values( array_unique( array_filter( $labels ) ) );
        return implode( ' / ', $labels );
    }

    private static function normalise_import_gait( $gait ) {
        $gait = strtolower( trim( (string) $gait ) );
        if ( in_array( $gait, array( 'trotter', 'trotting', 'trot' ), true ) ) return 'Trotter';
        return 'Pacer';
    }

    /* ════════════════════════════════════
       ENQUIRY HANDLERS
    ════════════════════════════════════ */

    /* ── Public: submit listing enquiry ── */
    public static function submit_enquiry() {
        check_ajax_referer( 'hld_nonce', 'nonce' );

        $name  = sanitize_text_field( wp_unslash( $_POST['contact_name']  ?? '' ) );
        $email = sanitize_email(      wp_unslash( $_POST['contact_email'] ?? '' ) );
        $type  = sanitize_text_field( wp_unslash( $_POST['listing_type']  ?? '' ) );

        if ( ! $name )               wp_send_json_error( 'Please enter your name.' );
        if ( ! is_email( $email ) )  wp_send_json_error( 'Please enter a valid email address.' );
        if ( ! $type )               wp_send_json_error( 'Please select a listing type.' );

        $id = HLD_DB::insert_enquiry( wp_unslash( $_POST ) );

        if ( ! $id ) {
            wp_send_json_error( 'Sorry, there was a problem saving your enquiry. Please try again.' );
        }

        /* Optional: ping the admin with a simple WP mail */
        $admin_email = get_option( 'admin_email' );
        $subject     = '[HarnessLink] New listing enquiry — ' . $type . ' from ' . $name;
        $body        = "A new listing enquiry was submitted on HarnessLink.\n\n"
                     . "Name:         {$name}\n"
                     . "Email:        {$email}\n"
                     . "Phone:        " . sanitize_text_field( wp_unslash( $_POST['contact_phone'] ?? '—' ) ) . "\n"
                     . "Listing Type: {$type}\n"
                     . "Stud / Name:  " . sanitize_text_field( wp_unslash( $_POST['stud_name'] ?? '—' ) ) . "\n"
                     . "Country:      " . sanitize_text_field( wp_unslash( $_POST['country'] ?? '—' ) ) . "\n"
                     . "Region:       " . sanitize_text_field( wp_unslash( $_POST['region'] ?? '—' ) ) . "\n\n"
                     . "Message:\n" . sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '—' ) ) . "\n\n"
                     . "View in admin: " . admin_url( 'admin.php?page=hld-enquiries' );

        wp_mail( $admin_email, $subject, $body );

        wp_send_json_success( array(
            'message' => 'Thank you! Your enquiry has been received. A member of the HarnessLink team will be in touch shortly.',
            'id'      => $id,
        ) );
    }

    /* ── Admin: get single enquiry for detail modal ── */
    public static function get_enquiry() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $id = absint( $_POST['id'] ?? 0 );
        $e  = HLD_DB::get_enquiry( $id );
        if ( ! $e ) wp_send_json_error( 'Not found' );
        wp_send_json_success( $e );
    }

    /* ── Admin: update enquiry status + notes ── */
    public static function update_enquiry_status() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $id     = absint( $_POST['id'] ?? 0 );
        $status = sanitize_text_field( wp_unslash( $_POST['status'] ?? '' ) );
        $notes  = sanitize_textarea_field( wp_unslash( $_POST['admin_notes'] ?? '' ) );
        HLD_DB::update_enquiry_status( $id, $status, $notes );
        wp_send_json_success( array( 'message' => 'Enquiry updated.' ) );
    }

    /* ── Admin: delete enquiry ── */
    public static function delete_enquiry() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $id = absint( $_POST['id'] ?? 0 );
        HLD_DB::delete_enquiry( $id );
        wp_send_json_success( array( 'message' => 'Enquiry deleted.' ) );
    }

    /* ════════════════════════════════════
       GALLERY HANDLERS
    ════════════════════════════════════ */

    /* ── Get all gallery items for a stallion ── */
    public static function get_gallery() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $stallion_id = absint( $_POST['stallion_id'] ?? 0 );
        $items = HLD_DB::get_gallery( $stallion_id );
        wp_send_json_success( $items );
    }

    /* ── Add a single gallery item (URL or attachment) ── */
    public static function add_gallery_item() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );

        $stallion_id   = absint( $_POST['stallion_id'] ?? 0 );
        $attachment_id = absint( $_POST['attachment_id'] ?? 0 );
        $url           = sanitize_text_field( wp_unslash( $_POST['url'] ?? '' ) );
        $media_type    = sanitize_text_field( wp_unslash( $_POST['media_type'] ?? 'image' ) );
        $caption       = sanitize_text_field( wp_unslash( $_POST['caption'] ?? '' ) );

        if ( ! $stallion_id ) wp_send_json_error( 'Missing stallion ID.' );

        /* If uploading via media library, resolve URL from attachment */
        if ( $attachment_id && ! $url ) {
            $url = wp_get_attachment_url( $attachment_id );
            if ( ! $url ) wp_send_json_error( 'Could not resolve attachment URL.' );
        }

        if ( ! $url ) wp_send_json_error( 'No URL provided.' );

        /* Auto-detect media type from extension if not explicitly set */
        $ext = strtolower( pathinfo( parse_url( $url, PHP_URL_PATH ), PATHINFO_EXTENSION ) );
        if ( in_array( $ext, array( 'mp4', 'mov', 'webm', 'avi', 'mkv' ) ) ) {
            $media_type = 'video';
        }

        /* Count existing items for sort_order */
        $existing = HLD_DB::get_gallery( $stallion_id );
        $sort     = count( $existing );

        $id = HLD_DB::add_gallery_item( $stallion_id, array(
            'media_type'    => $media_type,
            'url'           => $url,
            'attachment_id' => $attachment_id,
            'caption'       => $caption,
            'sort_order'    => $sort,
        ) );

        wp_send_json_success( array(
            'id'            => $id,
            'stallion_id'   => $stallion_id,
            'media_type'    => $media_type,
            'url'           => $url,
            'attachment_id' => $attachment_id,
            'caption'       => $caption,
            'sort_order'    => $sort,
        ) );
    }

    /* ── Update caption ── */
    public static function update_gallery_caption() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $id      = absint( $_POST['id'] ?? 0 );
        $caption = sanitize_text_field( wp_unslash( $_POST['caption'] ?? '' ) );
        HLD_DB::update_gallery_item( $id, array( 'caption' => $caption ) );
        wp_send_json_success( array( 'message' => 'Caption saved.' ) );
    }

    /* ── Delete a gallery item ── */
    public static function delete_gallery_item() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $id = absint( $_POST['id'] ?? 0 );

        /* Optionally: leave media library file untouched — just remove the record */
        HLD_DB::delete_gallery_item( $id );
        wp_send_json_success( array( 'message' => 'Item removed.' ) );
    }

    /* ── Reorder gallery (drag & drop) ── */
    public static function reorder_gallery() {
        if ( ! current_user_can( 'manage_options' ) ) wp_send_json_error( 'Unauthorized' );
        check_ajax_referer( 'hld_admin_nonce', 'nonce' );
        $stallion_id = absint( $_POST['stallion_id'] ?? 0 );
        $order       = array_map( 'absint', $_POST['order'] ?? array() );
        if ( $stallion_id && $order ) {
            HLD_DB::reorder_gallery( $stallion_id, $order );
        }
        wp_send_json_success();
    }
}
