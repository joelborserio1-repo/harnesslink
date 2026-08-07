<?php
/**
 * HLN_Outbound_RSS — custom outbound RSS feeds (spec §7.2), populated
 * automatically from Published posts only.
 *
 * Registered via add_feed() rather than claiming the site's own /feed/
 * path, so this never collides with or replaces HarnessLink's existing
 * default site feed: /feed/hln-all/ (all), /feed/hln-region-{region}/,
 * /feed/hln-breaking/ (Tier 1 only). See README for the exact URLs —
 * this is a deliberate naming deviation from the spec's literal
 * /feed/{region} shorthand, made to avoid hijacking core's feed route.
 *
 * Carries structured fields a default WP feed doesn't — region, tier,
 * entities, source — via an RSS 2.0 namespace extension.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Outbound_RSS {

	const XML_NS = 'https://harnesslink.com/ns/newsroom/1.0';

	public function __construct() {
		add_action( 'init', [ $this, 'register_feeds' ] );
		add_action( 'init', [ $this, 'maybe_flush_rewrite_rules' ], 99 );
	}

	public function register_feeds() {
		add_feed( 'hln-all', [ $this, 'render_all' ] );
		add_feed( 'hln-breaking', [ $this, 'render_breaking' ] );
		foreach ( HLN_Sources::REGIONS as $region ) {
			add_feed( 'hln-region-' . $region, function () use ( $region ) {
				$this->render_region( $region );
			} );
		}
	}

	public function maybe_flush_rewrite_rules() {
		if ( get_option( 'hln_feed_rewrite_version' ) === HLN_VERSION ) {
			return;
		}
		flush_rewrite_rules( false );
		update_option( 'hln_feed_rewrite_version', HLN_VERSION );
	}

	public function render_all() {
		$this->render_feed( self::query_published() );
	}

	public function render_region( $region ) {
		$this->render_feed( self::query_published( [ [ 'key' => '_hln_region', 'value' => $region ] ] ) );
	}

	public function render_breaking() {
		$this->render_feed( self::query_published( [ [ 'key' => '_hln_tier', 'value' => 1 ] ] ) );
	}

	/* =========================================================
	   QUERY
	========================================================= */

	private static function query_published( array $extra_meta = [] ) {
		$meta_query = array_merge(
			[ [ 'key' => '_hln_source_credit', 'compare' => 'EXISTS' ] ],
			$extra_meta
		);
		return new WP_Query( [
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'posts_per_page' => 30,
			'orderby'        => 'date',
			'order'          => 'DESC',
			'meta_query'     => $meta_query,
		] );
	}

	/* =========================================================
	   XML OUTPUT
	========================================================= */

	private function render_feed( WP_Query $query ) {
		header( 'Content-Type: ' . feed_content_type( 'rss2' ) . '; charset=' . get_option( 'blog_charset' ), true );
		echo '<?xml version="1.0" encoding="' . esc_attr( get_option( 'blog_charset' ) ) . '"?' . '>';
		?>
<rss version="2.0" xmlns:hln="<?php echo esc_attr( self::XML_NS ); ?>">
<channel>
	<title><?php bloginfo_rss( 'name' ); ?> — HarnessLink Newsroom</title>
	<link><?php bloginfo_rss( 'url' ); ?></link>
	<description><?php bloginfo_rss( 'description' ); ?></description>
	<language><?php bloginfo_rss( 'language' ); ?></language>
	<?php foreach ( $query->posts as $post ) :
		$region   = get_post_meta( $post->ID, '_hln_region', true );
		$tier     = get_post_meta( $post->ID, '_hln_tier', true );
		$source   = get_post_meta( $post->ID, '_hln_source_credit', true );
		$entities = array_map( 'sanitize_text_field', wp_get_post_tags( $post->ID, [ 'fields' => 'names' ] ) );
	?>
	<item>
		<title><?php echo esc_html( get_the_title( $post ) ); ?></title>
		<link><?php echo esc_url( get_permalink( $post ) ); ?></link>
		<guid><?php echo esc_url( get_permalink( $post ) ); ?></guid>
		<pubDate><?php echo esc_html( mysql2date( 'D, d M Y H:i:s O', $post->post_date_gmt, false ) ); ?></pubDate>
		<description><![CDATA[<?php echo wp_kses_post( $post->post_excerpt ); ?>]]></description>
		<hln:region><?php echo esc_html( $region ); ?></hln:region>
		<hln:tier><?php echo esc_html( $tier ); ?></hln:tier>
		<hln:source><?php echo esc_html( $source ); ?></hln:source>
		<?php foreach ( $entities as $entity ) : ?>
		<hln:entity><?php echo esc_html( $entity ); ?></hln:entity>
		<?php endforeach; ?>
	</item>
	<?php endforeach; ?>
</channel>
</rss>
		<?php
	}
}
