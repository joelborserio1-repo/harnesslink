<?php
/**
 * HLN_Syndication — outbound syndication stubs (spec §17). No partner
 * integrations exist yet; all three ship disabled by default. This is
 * the scaffold for when they do, not a working integration.
 *
 * - Partner push: webhook call carrying the structured package +
 *   format_outputs on publish.
 * - Governing-body distribution: pushing the brief format back to a
 *   body's own news page.
 * - Social auto-post: pushing social_snippet to HarnessLink's OWN
 *   accounts on publish — distinct from Phase 3's read-only monitoring
 *   of OTHER accounts.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Syndication {

	public function __construct() {
		add_action( 'transition_post_status', [ $this, 'maybe_syndicate' ], 10, 3 );
	}

	public function maybe_syndicate( $new_status, $old_status, $post ) {
		if ( 'publish' !== $new_status || 'publish' === $old_status ) {
			return;
		}
		if ( ! get_post_meta( $post->ID, '_hln_source_credit', true ) ) {
			return; // Not a newsroom-originated post.
		}

		if ( get_option( 'hln_syndication_partner_push_enabled', false ) ) {
			$this->partner_push( $post->ID );
		}
		if ( get_option( 'hln_syndication_governing_body_enabled', false ) ) {
			$this->governing_body_distribution( $post->ID );
		}
		if ( get_option( 'hln_syndication_social_autopost_enabled', false ) ) {
			$this->social_auto_post( $post->ID );
		}
	}

	/**
	 * @param int $post_id
	 */
	public function partner_push( $post_id ) {
		$endpoints = apply_filters( 'hln_syndication_partner_endpoints', [] );
		if ( empty( $endpoints ) ) {
			return; // No partners configured yet.
		}
		$package = $this->build_package( $post_id );
		foreach ( $endpoints as $endpoint_url ) {
			wp_remote_post( $endpoint_url, [
				'timeout' => 15,
				'body'    => wp_json_encode( $package ),
				'headers' => [ 'Content-Type' => 'application/json' ],
			] );
		}
	}

	/**
	 * @param int $post_id
	 */
	public function governing_body_distribution( $post_id ) {
		$endpoint = apply_filters( 'hln_syndication_governing_body_endpoint', '', get_post_meta( $post_id, '_hln_region', true ) );
		if ( empty( $endpoint ) ) {
			return; // No governing-body endpoint configured for this region yet.
		}
		wp_remote_post( $endpoint, [
			'timeout' => 15,
			'body'    => wp_json_encode( [ 'brief' => $this->brief_for( $post_id ) ] ),
			'headers' => [ 'Content-Type' => 'application/json' ],
		] );
	}

	/**
	 * @param int $post_id
	 */
	public function social_auto_post( $post_id ) {
		do_action( 'hln_social_auto_post', $this->social_snippet_for( $post_id ), get_permalink( $post_id ) );
		// No default handler is hooked — posting to HarnessLink's own
		// accounts is left to whatever integration hooks this action.
	}

	private function build_package( $post_id ) {
		return [
			'title'          => get_the_title( $post_id ),
			'url'            => get_permalink( $post_id ),
			'brief'          => $this->brief_for( $post_id ),
			'social_snippet' => $this->social_snippet_for( $post_id ),
			'region'         => get_post_meta( $post_id, '_hln_region', true ),
			'tier'           => get_post_meta( $post_id, '_hln_tier', true ),
		];
	}

	private function brief_for( $post_id ) {
		$candidate_id = $this->candidate_id_for( $post_id );
		return $candidate_id ? ( HLN_Candidate_CPT::get_meta( $candidate_id, 'format_outputs', [] )['brief'] ?? '' ) : '';
	}

	private function social_snippet_for( $post_id ) {
		$candidate_id = $this->candidate_id_for( $post_id );
		return $candidate_id ? ( HLN_Candidate_CPT::get_meta( $candidate_id, 'format_outputs', [] )['social_snippet'] ?? '' ) : '';
	}

	private function candidate_id_for( $post_id ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_hln_wp_post_id' AND meta_value = %d LIMIT 1",
			$post_id
		) );
	}
}
