<?php
/**
 * HLN_Email_Intake — inbound-parse webhook for the news@ inbox (spec §3.1).
 *
 * Decision per spec: an inbound-parse webhook (the email provider POSTs a
 * parsed message to us), not IMAP polling. The payload shape is provider-
 * specific — HLN_INBOUND_EMAIL_PROVIDER below is the single place that
 * assumption lives; only the Mailgun inbound-parse shape is implemented
 * today, but parse_payload() dispatches on this constant so a different
 * provider can be added without touching the rest of the class.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'HLN_INBOUND_EMAIL_PROVIDER' ) ) {
	define( 'HLN_INBOUND_EMAIL_PROVIDER', 'mailgun' );
}

class HLN_Email_Intake {

	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route( 'hln/v1', '/inbound-email', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'handle_inbound_email' ],
			'permission_callback' => '__return_true', // Authenticated via webhook signature, not WP auth — see verify_signature().
		] );
	}

	/**
	 * @param  WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function handle_inbound_email( WP_REST_Request $request ) {
		if ( ! $this->verify_signature( $request ) ) {
			return new WP_REST_Response( [ 'error' => 'Signature verification failed.' ], 403 );
		}

		$payload = $this->parse_payload( $request );
		$sender_email = $this->extract_email_address( $payload['sender'] );

		$matched = $sender_email ? HLN_Sources::match_by_sender_email( $sender_email ) : null;

		if ( ! $matched ) {
			HLN_Intake_Log::insert( [
				'channel' => 'email',
				'status'  => HLN_Intake_Log::STATUS_UNCLASSIFIED,
				'headline' => HLN_Parsing_Utils::extract_short_excerpt( $payload['subject'], 20 ),
				'reason'  => sprintf( 'Sender "%s" does not match any enabled Source Registry entry.', $sender_email ?: '(unparseable)' ),
			] );
			return new WP_REST_Response( [ 'status' => 'unclassified' ], 200 );
		}

		$this->process_matched_email( $payload, $matched );

		return new WP_REST_Response( [ 'status' => 'processed' ], 200 );
	}

	/* =========================================================
	   PROCESSING
	========================================================= */

	private function process_matched_email( array $payload, array $source ) {
		$attachment_texts = [];
		$images            = [];

		foreach ( $payload['attachments'] as $attachment ) {
			if ( 'pdf' !== strtolower( pathinfo( $attachment['filename'] ?? '', PATHINFO_EXTENSION ) ) ) {
				continue;
			}
			$binary = @file_get_contents( $attachment['tmp_path'] );
			if ( false === $binary ) {
				continue;
			}
			$attachment_texts[] = HLN_Parsing_Utils::extract_pdf_text( $binary );
		}

		$combined_text = trim( $payload['subject'] . "\n" . $payload['body'] . "\n" . implode( "\n", $attachment_texts ) );
		$links         = $this->extract_links( $payload['html'] ?: $payload['body'] );
		$images        = $this->extract_images( $payload['html'] );

		$is_stewards = HLN_Parsing_Utils::looks_like_stewards_report( $payload['subject'] )
			|| HLN_Parsing_Utils::looks_like_stewards_report( $combined_text );

		if ( $is_stewards ) {
			$parsed = HLN_Stewards_Parser::parse( $combined_text, $source );

			HLN_Intake_Log::insert( [
				'channel'                   => 'email',
				'status'                    => $parsed['requires_source_clearance'] ? HLN_Intake_Log::STATUS_QUARANTINED : HLN_Intake_Log::STATUS_PROCESSED,
				'source_type'               => $source['source_type'],
				'source_slug'               => $source['_slug'],
				'source_name'               => $source['label'],
				'source_credit'             => $source['label'],
				'region'                    => $source['region'],
				'governing_body'            => $source['governing_body'],
				'trust_score'               => $source['trust_score'] ?? null,
				'headline'                  => $parsed['headline'],
				'body_excerpt'              => $parsed['body_excerpt'],
				'original_url'              => $links[0] ?? null,
				'published_at'              => $payload['date'],
				'entities'                  => array_merge( $parsed['entities'], [ 'stewards_tags' => $parsed['tags'] ] ),
				'data_type'                 => 'article',
				'images'                    => $images,
				'requires_source_clearance' => $parsed['requires_source_clearance'] ? 1 : 0,
				'confirm_status'            => $parsed['confirm_status'],
			] );
			return;
		}

		HLN_Intake_Log::insert( [
			'channel'        => 'email',
			'status'         => HLN_Intake_Log::STATUS_PROCESSED,
			'source_type'    => $source['source_type'],
			'source_slug'    => $source['_slug'],
			'source_name'    => $source['label'],
			'source_credit'  => $source['label'],
			'region'         => $source['region'],
			'governing_body' => $source['governing_body'],
			'trust_score'    => $source['trust_score'] ?? null,
			'headline'       => HLN_Parsing_Utils::extract_short_excerpt( $payload['subject'], 20 ),
			'body_excerpt'   => HLN_Parsing_Utils::extract_short_excerpt( $combined_text ),
			'original_url'   => $links[0] ?? null,
			'published_at'   => $payload['date'],
			'entities'       => HLN_Parsing_Utils::extract_entities_naive( $combined_text ),
			'data_type'      => 'article',
			'images'         => $images,
			'verify_against_official' => 'trade-press' === $source['source_type'] ? 1 : 0,
		] );
	}

	/* =========================================================
	   PROVIDER PAYLOAD PARSING
	========================================================= */

	/**
	 * @param  WP_REST_Request $request
	 * @return array {sender, subject, body, html, date, attachments[]}
	 */
	private function parse_payload( WP_REST_Request $request ) {
		switch ( HLN_INBOUND_EMAIL_PROVIDER ) {
			case 'mailgun':
			default:
				return $this->parse_mailgun_payload( $request );
		}
	}

	private function parse_mailgun_payload( WP_REST_Request $request ) {
		$attachments = [];
		$count       = (int) $request->get_param( 'attachment-count' );
		$files       = $request->get_file_params();

		for ( $i = 1; $i <= $count; $i++ ) {
			$key = 'attachment-' . $i;
			if ( isset( $files[ $key ] ) && UPLOAD_ERR_OK === $files[ $key ]['error'] ) {
				$attachments[] = [
					'filename' => $files[ $key ]['name'],
					'tmp_path' => $files[ $key ]['tmp_name'],
					'type'     => $files[ $key ]['type'],
				];
			}
		}

		$date_header = $request->get_param( 'Date' );

		return [
			'sender'      => (string) $request->get_param( 'sender' ),
			'subject'     => (string) $request->get_param( 'subject' ),
			'body'        => (string) $request->get_param( 'body-plain' ),
			'html'        => (string) $request->get_param( 'body-html' ),
			'date'        => $date_header ? gmdate( 'Y-m-d H:i:s', strtotime( $date_header ) ) : current_time( 'mysql' ),
			'attachments' => $attachments,
		];
	}

	/* =========================================================
	   SIGNATURE VERIFICATION
	========================================================= */

	/**
	 * Mailgun-style HMAC verification: hash_hmac('sha256', timestamp . token, signing_key).
	 * The signing key is set on the Settings screen (hln_inbound_email_signing_key);
	 * until it is configured, every request is rejected rather than trusted blindly —
	 * the sender-registry match alone is not authentication, since the 'sender'
	 * field in the POST body is otherwise just an unverified claim.
	 *
	 * @param  WP_REST_Request $request
	 * @return bool
	 */
	private function verify_signature( WP_REST_Request $request ) {
		$signing_key = get_option( 'hln_inbound_email_signing_key', '' );
		if ( '' === $signing_key ) {
			return false;
		}

		$timestamp = (string) $request->get_param( 'timestamp' );
		$token     = (string) $request->get_param( 'token' );
		$signature = (string) $request->get_param( 'signature' );

		if ( '' === $timestamp || '' === $token || '' === $signature ) {
			return false;
		}

		$expected = hash_hmac( 'sha256', $timestamp . $token, $signing_key );
		return hash_equals( $expected, $signature );
	}

	/* =========================================================
	   HELPERS
	========================================================= */

	private function extract_email_address( $from_header ) {
		if ( preg_match( '/<([^>]+)>/', $from_header, $m ) ) {
			return strtolower( trim( $m[1] ) );
		}
		$from_header = trim( $from_header );
		return is_email( $from_header ) ? strtolower( $from_header ) : '';
	}

	private function extract_links( $text ) {
		if ( ! preg_match_all( '/https?:\/\/[^\s"\'<>]+/i', (string) $text, $m ) ) {
			return [];
		}
		return array_slice( array_unique( $m[0] ), 0, 10 );
	}

	private function extract_images( $html ) {
		if ( ! preg_match_all( '/<img[^>]+src=["\']([^"\']+)["\']/i', (string) $html, $m ) ) {
			return [];
		}
		$urls = array_slice( array_unique( $m[1] ), 0, 10 );
		return array_map( fn( $url ) => HLN_Parsing_Utils::build_image_entry( $url, false ), $urls );
	}
}
