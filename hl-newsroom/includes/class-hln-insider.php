<?php
/**
 * HLN_Insider — weekly WP-Cron job assembling a DRAFT newsletter post
 * (spec §9). Always left as a draft for manual editing — never auto-sent;
 * this class has no email-sending capability at all.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Insider {

	const TOP_STORIES_COUNT = 5;

	public function __construct() {
		add_filter( 'cron_schedules', [ $this, 'add_weekly_interval' ] );
		add_action( 'init', [ $this, 'ensure_schedule' ] );
		add_action( 'hln_insider_weekly', [ $this, 'assemble_draft' ] );
	}

	public function add_weekly_interval( $schedules ) {
		if ( ! isset( $schedules['weekly'] ) ) {
			$schedules['weekly'] = [ 'interval' => WEEK_IN_SECONDS, 'display' => __( 'Once Weekly', 'hl-newsroom' ) ];
		}
		return $schedules;
	}

	public function ensure_schedule() {
		if ( ! wp_next_scheduled( 'hln_insider_weekly' ) ) {
			wp_schedule_event( strtotime( 'next monday 08:00' ), 'weekly', 'hln_insider_weekly' );
		}
	}

	public function assemble_draft() {
		$top_stories     = HLN_Popular::get_popular_posts( self::TOP_STORIES_COUNT );
		$upcoming_races  = $this->upcoming_calendar_entries();
		$stewards_items  = $this->recent_stewards_items();

		$content = $this->render_content( $top_stories, $upcoming_races, $stewards_items );

		wp_insert_post( [
			'post_type'    => 'post',
			'post_status'  => 'draft',
			'post_title'   => sprintf( __( 'HarnessLink Insider — Week of %s', 'hl-newsroom' ), date_i18n( 'j F Y' ) ),
			'post_content' => $content,
		] );
	}

	private function upcoming_calendar_entries() {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_calendar';
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $table WHERE race_date BETWEEN %s AND %s ORDER BY race_date ASC LIMIT 15",
			current_time( 'Y-m-d' ), gmdate( 'Y-m-d', strtotime( '+7 days' ) )
		) );
	}

	private function recent_stewards_items() {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_intake_log';
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $table WHERE confirm_status IS NOT NULL AND ingested_at >= %s ORDER BY ingested_at DESC LIMIT 10",
			gmdate( 'Y-m-d H:i:s', strtotime( '-7 days' ) )
		) );
	}

	private function render_content( array $top_stories, array $upcoming_races, array $stewards_items ) {
		$content = "<h2>" . esc_html__( 'This Week\'s Top Stories', 'hl-newsroom' ) . "</h2>\n<ul>\n";
		foreach ( $top_stories as $story ) {
			$content .= sprintf( "<li><a href=\"%s\">%s</a></li>\n", esc_url( $story['url'] ), esc_html( $story['title'] ) );
		}
		$content .= "</ul>\n\n<h2>" . esc_html__( 'Coming Up This Week', 'hl-newsroom' ) . "</h2>\n<ul>\n";
		foreach ( $upcoming_races as $race ) {
			$content .= sprintf(
				"<li>%s — %s (%s)</li>\n",
				esc_html( $race->race_name ), esc_html( $race->race_date ), esc_html( $race->governing_body )
			);
		}
		$content .= "</ul>\n\n<h2>" . esc_html__( 'Market Movers & Stewards', 'hl-newsroom' ) . "</h2>\n<ul>\n";
		foreach ( $stewards_items as $item ) {
			$content .= sprintf( "<li>%s (%s)</li>\n", esc_html( $item->headline ), esc_html( $item->source_name ) );
		}
		$content .= "</ul>\n";

		return $content;
	}
}
