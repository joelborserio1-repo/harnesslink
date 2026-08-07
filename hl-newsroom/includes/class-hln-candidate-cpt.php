<?php
/**
 * HLN_Candidate_CPT — the Story Candidate custom post type (spec §4).
 *
 * Every schema field from spec §4 is stored as post meta prefixed _hln_
 * (headline lives in post_title; body_excerpt in post_excerpt; the
 * generated feature article, once one exists, in post_content).
 *
 * The full editorial lifecycle (spec §18, built out in Phase 6) is
 * represented as WordPress custom post statuses rather than a redundant
 * meta field, so admin list filtering/columns work the normal WP way:
 *
 *   hln_new              – Stage B just created it (Incoming/Recommended
 *                           in the dashboard, split by trending score,
 *                           not by status)
 *   hln_building          – draft generation triggered (Phase 5)
 *   hln_ready             – generation complete, QC passed
 *   hln_changes_required  – generation complete, QC failed
 *   hln_published         – a WordPress pending post has been created
 *                           for this candidate (Phase 6) — this is NOT
 *                           the same as that post being live
 *   hln_rejected          – a human rejected it
 *   hln_archived          – Phase 4's 3-day TTL swept it up
 *
 * Admin list columns/filter bar mirror the legacy plugin's class-ad-cpt.php
 * patterns (custom sortable columns, row actions, filter bar), renamed to
 * the hln_ prefix.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Candidate_CPT {

	const POST_TYPE = 'hln_candidate';

	const STATUSES = [ 'hln_new', 'hln_building', 'hln_ready', 'hln_changes_required', 'hln_published', 'hln_rejected', 'hln_archived' ];

	/** Un-actioned hln_new candidates older than this are auto-archived (spec §10's decided retention rule). */
	const TTL_DAYS = 3;

	public function __construct() {
		add_action( 'init', [ $this, 'register_post_type' ] );
		add_action( 'init', [ $this, 'register_statuses' ] );
		add_action( 'init', [ $this, 'ensure_ttl_schedule' ] );
		add_action( 'hln_candidate_ttl_sweep', [ $this, 'sweep_expired' ] );
		add_filter( 'manage_' . self::POST_TYPE . '_posts_columns', [ $this, 'columns' ] );
		add_action( 'manage_' . self::POST_TYPE . '_posts_custom_column', [ $this, 'render_column' ], 10, 2 );
		add_filter( 'manage_edit-' . self::POST_TYPE . '_sortable_columns', [ $this, 'sortable_columns' ] );
		add_action( 'restrict_manage_posts', [ $this, 'filter_bar' ] );
		add_filter( 'parse_query', [ $this, 'apply_filter_bar' ] );
	}

	public function ensure_ttl_schedule() {
		if ( ! wp_next_scheduled( 'hln_candidate_ttl_sweep' ) ) {
			wp_schedule_event( time(), 'daily', 'hln_candidate_ttl_sweep' );
		}
	}

	/**
	 * Anything still 'hln_new' (untouched — no generation triggered, no
	 * reviewer action) after TTL_DAYS is archived. Anything already
	 * promoted past hln_new follows the normal editorial lifecycle
	 * instead and is exempt.
	 */
	public function sweep_expired() {
		$expired = get_posts( [
			'post_type'      => self::POST_TYPE,
			'post_status'    => 'hln_new',
			'posts_per_page' => 100,
			'date_query'     => [ [ 'before' => gmdate( 'Y-m-d H:i:s', strtotime( '-' . self::TTL_DAYS . ' days' ) ) ] ],
		] );

		foreach ( $expired as $post ) {
			wp_update_post( [ 'ID' => $post->ID, 'post_status' => 'hln_archived' ] );
			self::append_audit( $post->ID, 'ttl_archived', sprintf( 'No action taken within %d days.', self::TTL_DAYS ) );
		}
	}

	public function register_post_type() {
		register_post_type( self::POST_TYPE, [
			'label'           => __( 'Story Candidates', 'hl-newsroom' ),
			'public'          => false,
			'show_ui'         => true,
			'show_in_menu'    => false, // Listed under the HarnessLink Newsroom menu instead — see HLN_Admin.
			'supports'        => [ 'title', 'editor', 'excerpt', 'custom-fields' ],
			'capability_type' => 'post',
			'map_meta_cap'    => true,
		] );
	}

	public function register_statuses() {
		$labels = [
			'hln_new'              => __( 'New', 'hl-newsroom' ),
			'hln_building'         => __( 'Building', 'hl-newsroom' ),
			'hln_ready'            => __( 'Ready for Review', 'hl-newsroom' ),
			'hln_changes_required' => __( 'Changes Required', 'hl-newsroom' ),
			'hln_published'        => __( 'Sent to WordPress', 'hl-newsroom' ),
			'hln_rejected'         => __( 'Rejected', 'hl-newsroom' ),
			'hln_archived'         => __( 'Archived (TTL)', 'hl-newsroom' ),
		];
		foreach ( $labels as $status => $label ) {
			register_post_status( $status, [
				'label'                     => $label,
				'public'                    => false,
				'internal'                  => true,
				'exclude_from_search'       => true,
				'show_in_admin_all_list'    => true,
				'show_in_admin_status_list' => true,
				/* translators: %s: count */
				'label_count'               => _n_noop( $label . ' <span class="count">(%s)</span>', $label . ' <span class="count">(%s)</span>', 'hl-newsroom' ),
			] );
		}
	}

	/* =========================================================
	   META HELPERS
	========================================================= */

	const META_KEYS = [
		'source_name', 'source_type', 'source_credit', 'region', 'governing_body',
		'original_url', 'published_at', 'entities', 'data_type', 'images', 'video',
		'trust_score', 'quality_score', 'trending_signal', 'trending_breakdown',
		'verify_against_official', 'requires_source_clearance', 'format_outputs',
		'headline_alternatives', 'is_premium', 'duplicate_of', 'story_type', 'tier',
		'template_id', 'template_version', 'qc_flags', 'guest_author', 'byline',
		'planned_tags', 'planned_category', 'source_intake_log_id', 'wp_post_id',
		'race_calendar_id',
	];

	/**
	 * Create a Story Candidate from an intake-log row (Stage B of triage).
	 *
	 * @param  object $row Row from hln_intake_log.
	 * @return int|WP_Error Post ID.
	 */
	public static function create_from_intake_row( $row ) {
		$post_id = wp_insert_post( [
			'post_type'    => self::POST_TYPE,
			'post_status'  => 'hln_new',
			'post_title'   => wp_strip_all_tags( (string) $row->headline ) ?: __( '(untitled)', 'hl-newsroom' ),
			'post_excerpt' => (string) $row->body_excerpt,
		], true );

		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		$entities = json_decode( (string) $row->entities, true ) ?: [];

		self::set_meta( $post_id, [
			'source_name'               => $row->source_name,
			'source_type'               => $row->source_type,
			'source_credit'             => $row->source_credit,
			'region'                    => $row->region,
			'governing_body'            => $row->governing_body,
			'original_url'              => $row->original_url,
			'published_at'              => $row->published_at,
			'entities'                  => $entities,
			'data_type'                 => $row->data_type,
			'images'                    => json_decode( (string) $row->images, true ) ?: [],
			'video'                     => json_decode( (string) $row->video, true ) ?: [],
			'trust_score'               => $row->trust_score,
			'verify_against_official'   => (bool) $row->verify_against_official,
			'requires_source_clearance' => (bool) $row->requires_source_clearance,
			'is_premium'                => false,
			'story_type'                => self::guess_story_type( $row->data_type, $row->source_type ),
			'source_intake_log_id'      => (int) $row->id,
			'byline'                    => get_option( 'hln_default_byline', 'HarnessLink Media' ),
			'guest_author'              => '',
		] );

		self::append_audit( $post_id, 'candidate_created', sprintf( 'Promoted from intake log #%d (%s).', $row->id, $row->channel ) );
		self::append_audit( $post_id, 'source_attached', sprintf( 'Source: %s (%s), credit: %s.', $row->source_name, $row->source_type, $row->source_credit ) );

		return $post_id;
	}

	/**
	 * Create a Story Candidate directly from a feature-race-calendar row
	 * (spec-driven deterministic link — see HLN_Race_Candidate_Link).
	 * Unlike create_from_intake_row(), there is no intake-log row behind
	 * this: the calendar entry itself is the source.
	 *
	 * @param  object $calendar_row Row from hln_race_calendar.
	 * @param  string $story_type   'preview' or 'result'.
	 * @param  string $headline
	 * @param  string $excerpt
	 * @param  int    $trust_score
	 * @return int|WP_Error Post ID.
	 */
	public static function create_from_calendar_row( $calendar_row, $story_type, $headline, $excerpt, $trust_score ) {
		$post_id = wp_insert_post( [
			'post_type'    => self::POST_TYPE,
			'post_status'  => 'hln_new',
			'post_title'   => $headline,
			'post_excerpt' => $excerpt,
		], true );

		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		self::set_meta( $post_id, [
			'source_name'    => $calendar_row->governing_body,
			'source_type'    => 'race-data',
			'source_credit'  => $calendar_row->governing_body,
			'region'         => $calendar_row->region,
			'governing_body' => $calendar_row->governing_body,
			'data_type'      => 'preview' === $story_type ? 'fixture' : 'result',
			'trust_score'    => $trust_score,
			'entities'       => [ $calendar_row->race_name ],
			'is_premium'     => false,
			'story_type'     => $story_type,
			'race_calendar_id' => (int) $calendar_row->id,
			'byline'         => get_option( 'hln_default_byline', 'HarnessLink Media' ),
			'guest_author'   => '',
		] );

		self::append_audit( $post_id, 'candidate_created', sprintf( 'Created directly from feature-race calendar entry #%d (%s).', $calendar_row->id, $story_type ) );
		self::append_audit( $post_id, 'source_attached', sprintf( 'Source: %s (race-data), race: %s.', $calendar_row->governing_body, $calendar_row->race_name ) );

		return $post_id;
	}

	private static function guess_story_type( $data_type, $source_type ) {
		if ( 'result' === $data_type ) {
			return 'result';
		}
		if ( 'fixture' === $data_type ) {
			return 'preview';
		}
		return 'news';
	}

	public static function set_meta( $post_id, array $fields ) {
		foreach ( $fields as $key => $value ) {
			if ( ! in_array( $key, self::META_KEYS, true ) ) {
				continue;
			}
			if ( is_array( $value ) ) {
				$value = wp_json_encode( $value );
			} elseif ( is_bool( $value ) ) {
				$value = $value ? 1 : 0;
			}
			update_post_meta( $post_id, '_hln_' . $key, $value );
		}
	}

	/**
	 * @param  int    $post_id
	 * @param  string $key
	 * @param  mixed  $default
	 * @return mixed
	 */
	public static function get_meta( $post_id, $key, $default = null ) {
		if ( ! in_array( $key, self::META_KEYS, true ) ) {
			return $default;
		}
		$value = get_post_meta( $post_id, '_hln_' . $key, true );
		if ( '' === $value || null === $value ) {
			return $default;
		}
		if ( in_array( $key, [ 'entities', 'images', 'video', 'format_outputs', 'headline_alternatives', 'qc_flags', 'planned_tags', 'trending_breakdown' ], true ) ) {
			$decoded = json_decode( $value, true );
			return is_array( $decoded ) ? $decoded : $default;
		}
		return $value;
	}

	/**
	 * Thin wrapper around HLN_Audit_Log, kept so existing call sites in
	 * this class didn't need to change when the audit log was
	 * generalised to also carry system-level (non-candidate) events.
	 *
	 * @param int    $post_id
	 * @param string $event
	 * @param string $detail
	 */
	public static function append_audit( $post_id, $event, $detail = '' ) {
		HLN_Audit_Log::log( $event, $detail, $post_id );
	}

	/**
	 * @param  int $post_id
	 * @return object[] Ordered oldest first.
	 */
	public static function get_audit_trail( $post_id ) {
		return HLN_Audit_Log::get_for_candidate( $post_id );
	}

	/* =========================================================
	   ADMIN LIST COLUMNS / FILTER BAR
	========================================================= */

	public function columns( $columns ) {
		$new = [];
		foreach ( $columns as $key => $label ) {
			$new[ $key ] = $label;
			if ( 'title' === $key ) {
				$new['hln_region']    = __( 'Region', 'hl-newsroom' );
				$new['hln_source']    = __( 'Source', 'hl-newsroom' );
				$new['hln_trust']     = __( 'Trust', 'hl-newsroom' );
				$new['hln_quality']   = __( 'Quality', 'hl-newsroom' );
				$new['hln_trending']  = __( 'Trending', 'hl-newsroom' );
				$new['hln_flags']     = __( 'Flags', 'hl-newsroom' );
			}
		}
		return $new;
	}

	public function render_column( $column, $post_id ) {
		switch ( $column ) {
			case 'hln_region':
				echo esc_html( self::get_meta( $post_id, 'region', '—' ) );
				break;
			case 'hln_source':
				echo esc_html( self::get_meta( $post_id, 'source_name', '—' ) );
				break;
			case 'hln_trust':
				echo esc_html( self::get_meta( $post_id, 'trust_score', '—' ) );
				break;
			case 'hln_quality':
				echo esc_html( self::get_meta( $post_id, 'quality_score', '—' ) );
				break;
			case 'hln_trending':
				echo esc_html( self::get_meta( $post_id, 'trending_signal', '—' ) );
				break;
			case 'hln_flags':
				if ( self::get_meta( $post_id, 'requires_source_clearance' ) ) {
					echo '<span class="hln-badge hln-badge-off">' . esc_html__( 'Clearance', 'hl-newsroom' ) . '</span> ';
				}
				if ( self::get_meta( $post_id, 'verify_against_official' ) ) {
					echo '<span class="hln-badge hln-badge-off">' . esc_html__( 'Verify', 'hl-newsroom' ) . '</span> ';
				}
				if ( self::get_meta( $post_id, 'duplicate_of' ) ) {
					echo '<span class="hln-badge hln-badge-off">' . esc_html__( 'Duplicate', 'hl-newsroom' ) . '</span>';
				}
				break;
		}
	}

	public function sortable_columns( $columns ) {
		$columns['hln_trust']    = 'hln_trust';
		$columns['hln_quality']  = 'hln_quality';
		$columns['hln_trending'] = 'hln_trending';
		return $columns;
	}

	public function filter_bar() {
		global $typenow;
		if ( self::POST_TYPE !== $typenow ) {
			return;
		}
		$current = isset( $_GET['hln_region_filter'] ) ? sanitize_text_field( wp_unslash( $_GET['hln_region_filter'] ) ) : '';
		echo '<select name="hln_region_filter"><option value="">' . esc_html__( 'All Regions', 'hl-newsroom' ) . '</option>';
		foreach ( HLN_Sources::REGIONS as $region ) {
			printf( '<option value="%1$s" %2$s>%1$s</option>', esc_attr( $region ), selected( $current, $region, false ) );
		}
		echo '</select>';
	}

	public function apply_filter_bar( $query ) {
		global $pagenow, $typenow;
		if ( 'edit.php' !== $pagenow || self::POST_TYPE !== $typenow || ! is_admin() ) {
			return $query;
		}
		if ( ! empty( $_GET['hln_region_filter'] ) ) {
			$query->query_vars['meta_key']   = '_hln_region';
			$query->query_vars['meta_value'] = sanitize_text_field( wp_unslash( $_GET['hln_region_filter'] ) );
		}
		return $query;
	}
}
