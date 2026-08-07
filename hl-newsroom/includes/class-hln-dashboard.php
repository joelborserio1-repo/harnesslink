<?php
/**
 * HLN_Dashboard — the editorial dashboard and single review screen
 * (spec §18), plus the WordPress publish integration (spec §7.1) and
 * kill-switch UI (Hard Requirement 5).
 *
 * Dashboard columns: Incoming, Recommended, Building, Ready for Review,
 * Changes Required, Published. Incoming/Recommended both draw from the
 * hln_new queue, split by trending score — not by a stored status.
 *
 * The Publish action here only ever creates/updates a WordPress post
 * with status 'pending' — never 'publish'. A second, explicit "Go live"
 * action (the normal WP editorial process) governs the final
 * pending -> live transition. That rule is enforced in handle_publish()
 * itself, not just left to the UI to respect.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Dashboard {

	/** Trending score at/above which an Incoming item is promoted to Recommended in the UI split. */
	const RECOMMENDED_THRESHOLD = 40;

	public function __construct() {
		add_action( 'admin_post_hln_trigger_generate', [ __CLASS__, 'handle_trigger_generate' ] );
		add_action( 'admin_post_hln_publish', [ __CLASS__, 'handle_publish' ] );
		add_action( 'admin_post_hln_reject', [ __CLASS__, 'handle_reject' ] );
		add_action( 'admin_post_hln_save_review_edit', [ __CLASS__, 'handle_save_edit' ] );
		add_action( 'admin_post_hln_toggle_kill_switch', [ __CLASS__, 'handle_toggle_kill_switch' ] );
	}

	/* =========================================================
	   DASHBOARD
	========================================================= */

	public static function render_dashboard() {
		$region = isset( $_GET['region'] ) ? sanitize_text_field( wp_unslash( $_GET['region'] ) ) : '';
		$notice = isset( $_GET['hln_notice'] ) ? sanitize_text_field( wp_unslash( $_GET['hln_notice'] ) ) : '';
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-analytics"></span> <?php _e( 'Editorial Dashboard', 'hl-newsroom' ); ?></h1>

			<?php if ( $notice ) : ?>
				<div class="notice notice-info is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>

			<?php self::render_kill_switch_panel(); ?>
			<?php self::render_provider_status_banner(); ?>

			<form method="get" action="" style="margin: 12px 0;">
				<input type="hidden" name="page" value="hln-dashboard" />
				<label for="hln-dash-region"><?php _e( 'Region:', 'hl-newsroom' ); ?></label>
				<select name="region" id="hln-dash-region" onchange="this.form.submit()">
					<option value=""><?php _e( 'All Regions', 'hl-newsroom' ); ?></option>
					<?php foreach ( HLN_Sources::REGIONS as $r ) : ?>
						<option value="<?php echo esc_attr( $r ); ?>" <?php selected( $region, $r ); ?>><?php echo esc_html( $r ); ?></option>
					<?php endforeach; ?>
				</select>
			</form>

			<div class="hln-dashboard-columns">
				<?php
				self::render_column( __( 'Incoming', 'hl-newsroom' ), self::query_new( $region, false ), 'incoming' );
				self::render_column( __( 'Recommended', 'hl-newsroom' ), self::query_new( $region, true ), 'recommended' );
				self::render_column( __( 'Building', 'hl-newsroom' ), self::query_status( 'hln_building', $region ), 'building' );
				self::render_column( __( 'Ready for Review', 'hl-newsroom' ), self::query_status( 'hln_ready', $region ), 'ready' );
				self::render_column( __( 'Changes Required', 'hl-newsroom' ), self::query_status( 'hln_changes_required', $region ), 'changes' );
				self::render_column( __( 'Published', 'hl-newsroom' ), self::query_status( 'hln_published', $region ), 'published' );
				?>
			</div>
		</div>
		<?php
	}

	private static function query_new( $region, $recommended ) {
		$threshold = (float) HLN_Trending::get_weights()['recommended_threshold'];
		$posts     = self::query_status( 'hln_new', $region );
		return array_values( array_filter( $posts, function ( $p ) use ( $recommended, $threshold ) {
			$score = (float) HLN_Candidate_CPT::get_meta( $p->ID, 'trending_signal', 0 );
			return $recommended ? $score >= $threshold : $score < $threshold;
		} ) );
	}

	private static function render_provider_status_banner() {
		$status = HLN_Story_Generator::get_provider_status();
		if ( $status['configured'] && $status['available'] ) {
			return; // Nothing to warn about.
		}
		?>
		<div class="notice notice-warning">
			<p>
				<?php if ( ! $status['configured'] ) : ?>
					<?php _e( 'No generation provider is configured. "Generate Draft" will move candidates straight to Changes Required until one is set on the Settings screen.', 'hl-newsroom' ); ?>
				<?php else : ?>
					<?php printf( esc_html__( 'Generation provider (%s) is configured but reports itself unavailable.', 'hl-newsroom' ), esc_html( $status['class'] ) ); ?>
					<?php if ( $status['error'] ) : ?> — <?php echo esc_html( $status['error'] ); ?><?php endif; ?>
				<?php endif; ?>
			</p>
		</div>
		<?php
	}

	private static function query_status( $status, $region ) {
		$args = [
			'post_type'      => HLN_Candidate_CPT::POST_TYPE,
			'post_status'    => $status,
			'posts_per_page' => 25,
			'meta_key'       => '_hln_trending_signal',
			'orderby'        => 'meta_value_num',
			'order'          => 'DESC',
		];
		if ( $region ) {
			$args['meta_query'] = [ [ 'key' => '_hln_region', 'value' => $region ] ];
		}
		return get_posts( $args );
	}

	private static function render_column( $label, array $posts, $key ) {
		?>
		<div class="hln-dash-column">
			<h2><?php echo esc_html( $label ); ?> <span class="hln-dash-count">(<?php echo count( $posts ); ?>)</span></h2>
			<?php if ( empty( $posts ) ) : ?>
				<p class="description"><?php _e( 'Nothing here.', 'hl-newsroom' ); ?></p>
			<?php endif; ?>
			<?php foreach ( $posts as $post ) : ?>
				<div class="hln-dash-card">
					<strong><?php echo esc_html( get_the_title( $post ) ); ?></strong><br>
					<span class="description">
						<?php echo esc_html( HLN_Candidate_CPT::get_meta( $post->ID, 'source_name', '—' ) ); ?>
						· <?php echo esc_html( HLN_Candidate_CPT::get_meta( $post->ID, 'region', '—' ) ); ?>
						· <?php _e( 'Score', 'hl-newsroom' ); ?> <?php echo esc_html( HLN_Candidate_CPT::get_meta( $post->ID, 'trending_signal', 0 ) ); ?>
					</span><br>
					<?php if ( 'incoming' === $key || 'recommended' === $key ) : ?>
						<?php $killed = HLN_Kill_Switch::blocks_automatic_advancement( HLN_Kill_Switch::source_slug_for_candidate( $post->ID ) ); ?>
						<?php if ( $killed ) : ?>
							<span class="hln-badge hln-badge-off"><?php _e( 'Automation blocked', 'hl-newsroom' ); ?></span><br>
						<?php endif; ?>
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
							<?php wp_nonce_field( 'hln_trigger_generate_' . $post->ID ); ?>
							<input type="hidden" name="action" value="hln_trigger_generate" />
							<input type="hidden" name="candidate_id" value="<?php echo (int) $post->ID; ?>" />
							<button type="submit" class="button button-small" <?php disabled( $killed ); ?>><?php _e( 'Generate Draft', 'hl-newsroom' ); ?></button>
						</form>
					<?php elseif ( 'ready' === $key || 'changes' === $key ) : ?>
						<a class="button button-small" href="<?php echo esc_url( admin_url( 'admin.php?page=hln-review&id=' . $post->ID ) ); ?>"><?php _e( 'Review', 'hl-newsroom' ); ?></a>
					<?php elseif ( 'published' === $key ) : ?>
						<?php $wp_post_id = HLN_Candidate_CPT::get_meta( $post->ID, 'wp_post_id' ); ?>
						<?php if ( $wp_post_id ) : ?>
							<a class="button button-small" href="<?php echo esc_url( get_edit_post_link( $wp_post_id ) ); ?>"><?php _e( 'View WordPress Post', 'hl-newsroom' ); ?></a>
						<?php endif; ?>
					<?php else : ?>
						<span class="description"><?php _e( 'Generating…', 'hl-newsroom' ); ?></span>
					<?php endif; ?>
				</div>
			<?php endforeach; ?>
		</div>
		<?php
	}

	/* =========================================================
	   KILL SWITCH UI (Hard Requirement 5)
	========================================================= */

	private static function render_kill_switch_panel() {
		$global_killed  = (bool) get_option( 'hln_global_kill_switch', false );
		$source_killed  = get_option( 'hln_source_kill_switches', [] );
		$auto_publish_sources = array_filter( HLN_Sources::all_flat(), fn( $s ) => ! empty( $s['auto_publish'] ) );
		?>
		<div class="hln-panel">
			<h2><?php _e( 'Automation Kill Switch', 'hl-newsroom' ); ?></h2>
			<?php if ( $global_killed ) : ?>
				<div class="notice notice-error inline"><p><strong><?php _e( 'Global kill switch is ENGAGED. Automatic intake-to-candidate promotion and draft generation are blocked for every source.', 'hl-newsroom' ); ?></strong></p></div>
			<?php elseif ( ! empty( array_filter( $source_killed ) ) ) : ?>
				<div class="notice notice-warning inline"><p><?php _e( 'One or more sources have automation blocked. See below.', 'hl-newsroom' ); ?></p></div>
			<?php endif; ?>
			<p class="description"><?php _e( 'Blocks the pipeline\'s automatic advancement stages: intake -> candidate promotion (HLN_Triage, HLN_Race_Candidate_Link) and candidate -> generation, including the "Generate Draft" button below — generation is where this build\'s only current automation-adjacent step lives. Publish and Reject stay available regardless: those are the human review decision itself, the thing Hard Requirement 5 exists to require, not something this switch should block. These checks run inside HLN_Triage, HLN_Race_Candidate_Link, and HLN_Story_Generator directly — not only in this UI.', 'hl-newsroom' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'hln_toggle_kill_switch_nonce' ); ?>
				<input type="hidden" name="action" value="hln_toggle_kill_switch" />
				<label><input type="checkbox" name="hln_global_kill_switch" value="1" <?php checked( $global_killed ); ?> /> <strong><?php _e( 'Engage global kill switch (blocks every source)', 'hl-newsroom' ); ?></strong></label>
				<?php if ( ! empty( $auto_publish_sources ) ) : ?>
					<p><?php _e( 'Per-source (only sources with Auto-Publish enabled are listed):', 'hl-newsroom' ); ?></p>
					<?php foreach ( $auto_publish_sources as $key => $entry ) : ?>
						<label style="display:block;">
							<input type="checkbox" name="hln_source_kill_switches[]" value="<?php echo esc_attr( $entry['_slug'] ); ?>" <?php checked( ! empty( $source_killed[ $entry['_slug'] ] ) ); ?> />
							<?php echo esc_html( $entry['label'] ); ?>
						</label>
					<?php endforeach; ?>
				<?php endif; ?>
				<p class="submit"><button type="submit" class="button button-primary"><?php _e( 'Save', 'hl-newsroom' ); ?></button></p>
			</form>
		</div>
		<?php
	}

	public static function handle_toggle_kill_switch() {
		check_admin_referer( 'hln_toggle_kill_switch_nonce' );

		$was_global = HLN_Kill_Switch::is_globally_engaged();
		$is_global  = ! empty( $_POST['hln_global_kill_switch'] );
		update_option( 'hln_global_kill_switch', $is_global );
		if ( $was_global !== $is_global ) {
			HLN_Audit_Log::log( 'kill_switch_changed', $is_global ? 'Global kill switch engaged.' : 'Global kill switch disengaged.' );
		}

		$was_killed = get_option( 'hln_source_kill_switches', [] );
		$killed     = [];
		foreach ( (array) ( $_POST['hln_source_kill_switches'] ?? [] ) as $slug ) {
			$killed[ sanitize_text_field( wp_unslash( $slug ) ) ] = true;
		}
		update_option( 'hln_source_kill_switches', $killed );

		foreach ( array_unique( array_merge( array_keys( $was_killed ), array_keys( $killed ) ) ) as $slug ) {
			$before = ! empty( $was_killed[ $slug ] );
			$after  = ! empty( $killed[ $slug ] );
			if ( $before !== $after ) {
				HLN_Audit_Log::log( 'kill_switch_changed', $after ? "Source '{$slug}' automation blocked." : "Source '{$slug}' automation unblocked.", null, $slug );
			}
		}

		wp_safe_redirect( admin_url( 'admin.php?page=hln-dashboard&hln_notice=' . rawurlencode( __( 'Kill switch settings saved.', 'hl-newsroom' ) ) ) );
		exit;
	}

	/* =========================================================
	   ACTION: TRIGGER GENERATION
	========================================================= */

	public static function handle_trigger_generate() {
		$candidate_id = absint( $_POST['candidate_id'] ?? 0 );
		check_admin_referer( 'hln_trigger_generate_' . $candidate_id );

		if ( $candidate_id ) {
			$generator = new HLN_Story_Generator();
			$generator->generate_draft( $candidate_id );
		}

		wp_safe_redirect( admin_url( 'admin.php?page=hln-dashboard' ) );
		exit;
	}

	/* =========================================================
	   REVIEW SCREEN
	========================================================= */

	public static function render_review() {
		$candidate_id = absint( $_GET['id'] ?? 0 );
		$post = $candidate_id ? get_post( $candidate_id ) : null;

		if ( ! $post || HLN_Candidate_CPT::POST_TYPE !== $post->post_type ) {
			echo '<div class="wrap"><p>' . esc_html__( 'Candidate not found.', 'hl-newsroom' ) . '</p></div>';
			return;
		}

		$notice        = isset( $_GET['hln_notice'] ) ? sanitize_text_field( wp_unslash( $_GET['hln_notice'] ) ) : '';
		$format_outputs = HLN_Candidate_CPT::get_meta( $candidate_id, 'format_outputs', [] );
		$qc_flags       = HLN_Candidate_CPT::get_meta( $candidate_id, 'qc_flags', [] );
		$images         = HLN_Candidate_CPT::get_meta( $candidate_id, 'images', [] );
		$video          = HLN_Candidate_CPT::get_meta( $candidate_id, 'video', [] );
		$planned_tags   = HLN_Candidate_CPT::get_meta( $candidate_id, 'planned_tags', [] );
		$planned_cat    = HLN_Candidate_CPT::get_meta( $candidate_id, 'planned_category', [] );
		$requires_clearance = HLN_Candidate_CPT::get_meta( $candidate_id, 'requires_source_clearance' );
		$already_published  = HLN_Candidate_CPT::get_meta( $candidate_id, 'wp_post_id' );
		$audit_trail    = HLN_Candidate_CPT::get_audit_trail( $candidate_id );
		$breakdown      = HLN_Candidate_CPT::get_meta( $candidate_id, 'trending_breakdown', [] );
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-welcome-write-blog"></span> <?php echo esc_html( get_the_title( $candidate_id ) ); ?></h1>

			<?php if ( $notice ) : ?>
				<div class="notice notice-info is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>

			<?php if ( $requires_clearance ) : ?>
				<div class="notice notice-error"><p><?php _e( 'This candidate is flagged requires_source_clearance. Publish is disabled entirely and cannot be enabled from this screen, regardless of any other field here.', 'hl-newsroom' ); ?></p></div>
			<?php endif; ?>

			<div class="hln-panel">
				<h2><?php _e( 'Draft', 'hl-newsroom' ); ?></h2>
				<p><strong><?php _e( 'Quality Score:', 'hl-newsroom' ); ?></strong> <?php echo esc_html( HLN_Candidate_CPT::get_meta( $candidate_id, 'quality_score', '—' ) ); ?></p>
				<?php if ( ! empty( $qc_flags ) ) : ?>
					<p><strong><?php _e( 'QC Flags:', 'hl-newsroom' ); ?></strong></p>
					<ul>
						<?php foreach ( $qc_flags as $flag ) : ?><li><?php echo esc_html( $flag ); ?></li><?php endforeach; ?>
					</ul>
				<?php endif; ?>

				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<?php wp_nonce_field( 'hln_save_review_edit_' . $candidate_id ); ?>
					<input type="hidden" name="action" value="hln_save_review_edit" />
					<input type="hidden" name="candidate_id" value="<?php echo (int) $candidate_id; ?>" />
					<h3><?php _e( 'Feature (primary)', 'hl-newsroom' ); ?></h3>
					<textarea name="hln_feature" rows="16" class="large-text"><?php echo esc_textarea( $format_outputs['feature'] ?? '' ); ?></textarea>
					<h3><?php _e( 'Brief', 'hl-newsroom' ); ?></h3>
					<textarea name="hln_brief" rows="4" class="large-text"><?php echo esc_textarea( $format_outputs['brief'] ?? '' ); ?></textarea>
					<h3><?php _e( 'Social Snippet', 'hl-newsroom' ); ?></h3>
					<textarea name="hln_social_snippet" rows="2" class="large-text"><?php echo esc_textarea( $format_outputs['social_snippet'] ?? '' ); ?></textarea>
					<h3><?php _e( 'Summary (internal only — never published)', 'hl-newsroom' ); ?></h3>
					<textarea name="hln_summary" rows="4" class="large-text"><?php echo esc_textarea( $format_outputs['summary'] ?? '' ); ?></textarea>
					<p class="submit"><button type="submit" class="button"><?php _e( 'Save Edits', 'hl-newsroom' ); ?></button></p>
				</form>
			</div>

			<?php if ( ! empty( $breakdown ) ) : ?>
			<div class="hln-panel">
				<h2><?php printf( esc_html__( 'Why This Score: %s', 'hl-newsroom' ), esc_html( $breakdown['total'] ?? '—' ) ); ?></h2>
				<table class="wp-list-table widefat fixed striped">
					<thead><tr><th><?php _e( 'Component', 'hl-newsroom' ); ?></th><th><?php _e( 'Raw', 'hl-newsroom' ); ?></th><th><?php _e( 'Weight', 'hl-newsroom' ); ?></th><th><?php _e( 'Contribution', 'hl-newsroom' ); ?></th></tr></thead>
					<tbody>
						<?php foreach ( $breakdown['components'] ?? [] as $name => $c ) : ?>
							<tr>
								<td><?php echo esc_html( ucwords( str_replace( '_', ' ', $name ) ) ); ?></td>
								<td><?php echo esc_html( $c['raw'] ?? '—' ); ?></td>
								<td><?php echo esc_html( $c['weight'] ?? '—' ); ?></td>
								<td><?php echo esc_html( $c['contribution'] ?? '—' ); ?></td>
							</tr>
						<?php endforeach; ?>
						<?php if ( ! empty( $breakdown['breaking_news_boost']['applied'] ) ) : ?>
							<tr><td colspan="4"><?php printf( esc_html__( 'Breaking-news boost applied: ×%s', 'hl-newsroom' ), esc_html( $breakdown['breaking_news_boost']['multiplier'] ?? '' ) ); ?></td></tr>
						<?php endif; ?>
						<?php if ( ! empty( $breakdown['duplicate_demotion']['applied'] ) ) : ?>
							<tr><td colspan="4"><?php printf( esc_html__( 'Duplicate demotion applied: ×%s', 'hl-newsroom' ), esc_html( $breakdown['duplicate_demotion']['factor'] ?? '' ) ); ?></td></tr>
						<?php endif; ?>
					</tbody>
				</table>
			</div>
			<?php endif; ?>

			<div class="hln-panel">
				<h2><?php _e( 'Source & Media', 'hl-newsroom' ); ?></h2>
				<p><a href="<?php echo esc_url( HLN_Candidate_CPT::get_meta( $candidate_id, 'original_url' ) ); ?>" target="_blank"><?php echo esc_html( HLN_Candidate_CPT::get_meta( $candidate_id, 'original_url' ) ); ?></a></p>
				<?php foreach ( array_merge( $images, $video ) as $media ) : ?>
					<p>
						<?php echo esc_html( $media['url'] ?? '' ); ?>
						— <span class="hln-badge <?php echo ! empty( $media['rights_confirmed'] ) ? 'hln-badge-on' : 'hln-badge-off'; ?>"><?php echo ! empty( $media['rights_confirmed'] ) ? esc_html__( 'Rights Confirmed', 'hl-newsroom' ) : esc_html__( 'Rights NOT Confirmed', 'hl-newsroom' ); ?></span>
						<?php if ( ! empty( $media['agency_flagged'] ) ) : ?><span class="hln-badge hln-badge-off"><?php _e( 'Agency Flagged', 'hl-newsroom' ); ?></span><?php endif; ?>
					</p>
				<?php endforeach; ?>
			</div>

			<div class="hln-panel">
				<h2><?php _e( 'Tags, Category & Publish', 'hl-newsroom' ); ?></h2>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<?php wp_nonce_field( 'hln_publish_' . $candidate_id ); ?>
					<input type="hidden" name="action" value="hln_publish" />
					<input type="hidden" name="candidate_id" value="<?php echo (int) $candidate_id; ?>" />
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-review-region"><?php _e( 'Region', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_region_category" id="hln-review-region" value="<?php echo esc_attr( $planned_cat[0] ?? '' ); ?>" /></td>
						</tr>
						<tr>
							<th><label for="hln-review-subcategory"><?php _e( 'Sub-Category', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_subcategory" id="hln-review-subcategory" value="<?php echo esc_attr( $planned_cat[1] ?? '' ); ?>" /></td>
						</tr>
						<tr>
							<th><label for="hln-review-tags"><?php _e( 'Tags', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_tags" id="hln-review-tags" class="large-text" value="<?php echo esc_attr( implode( ', ', $planned_tags ) ); ?>" />
								<p class="description"><?php _e( 'Comma-separated. The byline author is already included per house convention (author-archive tag pages).', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
						<tr>
							<th><label for="hln-review-byline"><?php _e( 'Published-By (Byline)', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_guest_author" id="hln-review-byline" value="<?php echo esc_attr( HLN_Candidate_CPT::get_meta( $candidate_id, 'guest_author' ) ?: HLN_Candidate_CPT::get_meta( $candidate_id, 'byline' ) ); ?>" /></td>
						</tr>
						<tr>
							<th><?php _e( 'Confirm', 'hl-newsroom' ); ?></th>
							<td><label><input type="checkbox" name="hln_confirm_tags_category" value="1" required /> <?php _e( 'Tags and category are correct (required even if unchanged from the pre-fill)', 'hl-newsroom' ); ?></label></td>
						</tr>
					</table>
					<p class="submit">
						<button type="submit" class="button button-primary" <?php disabled( $requires_clearance ); ?>><?php echo $already_published ? esc_html__( 'Update WordPress Post', 'hl-newsroom' ) : esc_html__( 'Publish (send to WordPress as Pending)', 'hl-newsroom' ); ?></button>
					</p>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('<?php echo esc_js( __( 'Reject this candidate?', 'hl-newsroom' ) ); ?>');">
					<?php wp_nonce_field( 'hln_reject_' . $candidate_id ); ?>
					<input type="hidden" name="action" value="hln_reject" />
					<input type="hidden" name="candidate_id" value="<?php echo (int) $candidate_id; ?>" />
					<button type="submit" class="button button-secondary"><?php _e( 'Reject', 'hl-newsroom' ); ?></button>
				</form>
			</div>

			<div class="hln-panel">
				<h2><?php _e( 'Audit Trail', 'hl-newsroom' ); ?></h2>
				<table class="wp-list-table widefat fixed striped">
					<thead><tr><th><?php _e( 'Timestamp', 'hl-newsroom' ); ?></th><th><?php _e( 'Event', 'hl-newsroom' ); ?></th><th><?php _e( 'Detail', 'hl-newsroom' ); ?></th></tr></thead>
					<tbody>
						<?php foreach ( array_reverse( $audit_trail ) as $entry ) : ?>
							<tr><td><?php echo esc_html( $entry->created_at ); ?></td><td><?php echo esc_html( $entry->event ); ?></td><td><?php echo esc_html( $entry->detail ); ?></td></tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		</div>
		<?php
	}

	/* =========================================================
	   ACTION: SAVE INLINE EDIT
	========================================================= */

	public static function handle_save_edit() {
		$candidate_id = absint( $_POST['candidate_id'] ?? 0 );
		check_admin_referer( 'hln_save_review_edit_' . $candidate_id );

		$format_outputs = HLN_Candidate_CPT::get_meta( $candidate_id, 'format_outputs', [] );
		$format_outputs['feature']        = wp_kses_post( wp_unslash( $_POST['hln_feature'] ?? '' ) );
		$format_outputs['brief']          = sanitize_textarea_field( wp_unslash( $_POST['hln_brief'] ?? '' ) );
		$format_outputs['social_snippet'] = sanitize_textarea_field( wp_unslash( $_POST['hln_social_snippet'] ?? '' ) );
		$format_outputs['summary']        = sanitize_textarea_field( wp_unslash( $_POST['hln_summary'] ?? '' ) );

		HLN_Candidate_CPT::set_meta( $candidate_id, [ 'format_outputs' => $format_outputs ] );
		wp_update_post( [ 'ID' => $candidate_id, 'post_content' => $format_outputs['feature'] ] );
		HLN_Candidate_CPT::append_audit( $candidate_id, 'edited_inline', 'Reviewer edited the draft.' );

		wp_safe_redirect( admin_url( 'admin.php?page=hln-review&id=' . $candidate_id . '&hln_notice=' . rawurlencode( __( 'Edits saved.', 'hl-newsroom' ) ) ) );
		exit;
	}

	/* =========================================================
	   ACTION: PUBLISH  (spec §18 — pending, never publish, here)
	========================================================= */

	public static function handle_publish() {
		$candidate_id = absint( $_POST['candidate_id'] ?? 0 );
		check_admin_referer( 'hln_publish_' . $candidate_id );

		// Hard block, independent of the UI's disabled attribute.
		if ( HLN_Candidate_CPT::get_meta( $candidate_id, 'requires_source_clearance' ) ) {
			wp_safe_redirect( admin_url( 'admin.php?page=hln-review&id=' . $candidate_id . '&hln_notice=' . rawurlencode( __( 'Blocked: requires_source_clearance is set.', 'hl-newsroom' ) ) ) );
			exit;
		}
		if ( empty( $_POST['hln_confirm_tags_category'] ) ) {
			wp_safe_redirect( admin_url( 'admin.php?page=hln-review&id=' . $candidate_id . '&hln_notice=' . rawurlencode( __( 'Confirm tags/category before publishing.', 'hl-newsroom' ) ) ) );
			exit;
		}

		$region_name  = sanitize_text_field( wp_unslash( $_POST['hln_region_category'] ?? '' ) );
		$subcategory  = sanitize_text_field( wp_unslash( $_POST['hln_subcategory'] ?? '' ) );
		$guest_author = sanitize_text_field( wp_unslash( $_POST['hln_guest_author'] ?? '' ) );
		$tags         = self::sanitize_tags( wp_unslash( $_POST['hln_tags'] ?? '' ) );

		$candidate_status = get_post_status( $candidate_id );

		$format_outputs = HLN_Candidate_CPT::get_meta( $candidate_id, 'format_outputs', [] );
		[ 'category_id' => $category_id, 'warnings' => $category_warnings ] = self::get_or_create_category( $region_name, $subcategory );
		$existing_post  = HLN_Candidate_CPT::get_meta( $candidate_id, 'wp_post_id' );

		$post_args = [
			'post_type'    => 'post',
			'post_status'  => 'pending', // Never 'publish' — Hard Requirement 5.
			'post_title'   => get_the_title( $candidate_id ),
			'post_content' => $format_outputs['feature'] ?? '',
			'post_excerpt' => $format_outputs['brief'] ?? '',
		];
		if ( $category_id ) {
			$post_args['post_category'] = [ $category_id ];
		}

		if ( $existing_post ) {
			$post_args['ID'] = $existing_post;
			$wp_post_id = wp_update_post( $post_args, true );
		} else {
			$wp_post_id = wp_insert_post( $post_args, true );
		}

		if ( is_wp_error( $wp_post_id ) ) {
			HLN_Candidate_CPT::append_audit( $candidate_id, 'candidate_updated', 'Failed to create WordPress post: ' . $wp_post_id->get_error_message() );
			wp_safe_redirect( admin_url( 'admin.php?page=hln-review&id=' . $candidate_id . '&hln_notice=' . rawurlencode( __( 'Failed to create the WordPress post.', 'hl-newsroom' ) ) ) );
			exit;
		}

		if ( ! empty( $tags ) ) {
			$term_result = wp_set_post_terms( $wp_post_id, $tags, 'post_tag' );
			if ( is_wp_error( $term_result ) ) {
				$category_warnings[] = 'Tag assignment failed: ' . $term_result->get_error_message();
			}
		}

		update_post_meta( $wp_post_id, '_hln_source_credit', HLN_Candidate_CPT::get_meta( $candidate_id, 'source_credit' ) );
		update_post_meta( $wp_post_id, '_hln_guest_author', $guest_author );
		update_post_meta( $wp_post_id, '_hln_original_url', HLN_Candidate_CPT::get_meta( $candidate_id, 'original_url' ) );
		update_post_meta( $wp_post_id, '_hln_is_premium', HLN_Candidate_CPT::get_meta( $candidate_id, 'is_premium' ) ? 1 : 0 );
		update_post_meta( $wp_post_id, '_hln_region', HLN_Candidate_CPT::get_meta( $candidate_id, 'region' ) );
		update_post_meta( $wp_post_id, '_hln_tier', HLN_Candidate_CPT::get_meta( $candidate_id, 'tier' ) );
		update_post_meta( $wp_post_id, '_hln_story_type', HLN_Candidate_CPT::get_meta( $candidate_id, 'story_type' ) );

		HLN_Candidate_CPT::set_meta( $candidate_id, [ 'wp_post_id' => $wp_post_id, 'guest_author' => $guest_author, 'planned_tags' => $tags, 'planned_category' => [ $region_name, $subcategory ] ] );
		wp_update_post( [ 'ID' => $candidate_id, 'post_status' => 'hln_published' ] );

		foreach ( $category_warnings as $warning ) {
			HLN_Candidate_CPT::append_audit( $candidate_id, 'candidate_updated', $warning );
		}

		HLN_Candidate_CPT::append_audit( $candidate_id, 'published', 'WordPress post #' . $wp_post_id . ' created with status pending — not live.' );
		HLN_Candidate_CPT::append_audit( $candidate_id, 'review_approved', 'Reviewer published candidate.' );

		if ( 'hln_ready' !== $candidate_status ) {
			HLN_Candidate_CPT::append_audit( $candidate_id, 'manual_override', sprintf( 'Published from status "%s" rather than Ready for Review.', $candidate_status ) );
		}

		wp_safe_redirect( admin_url( 'admin.php?page=hln-review&id=' . $candidate_id . '&hln_notice=' . rawurlencode( __( 'Sent to WordPress as a pending post.', 'hl-newsroom' ) ) ) );
		exit;
	}

	/**
	 * @param  string $raw Comma-separated tag list from the review form.
	 * @return string[]
	 */
	private static function sanitize_tags( $raw ) {
		$tags = array_filter( array_map( 'trim', explode( ',', (string) $raw ) ) );
		$tags = array_map( function ( $tag ) {
			$tag = sanitize_text_field( $tag );
			return mb_substr( $tag, 0, 200 );
		}, $tags );
		return array_values( array_unique( array_filter( $tags ) ) );
	}

	/**
	 * Defensive term get-or-create — every WP taxonomy call here can fail
	 * for reasons outside this plugin's control (a term with the same
	 * name existing under a different taxonomy, a malformed/oversized
	 * name, a race with another process creating the same term). None of
	 * those should hard-fail the whole Publish action: on any failure
	 * this returns 0 (no category assigned) rather than throwing, and
	 * the caller logs a warning to the audit trail so the gap is visible
	 * without blocking the post from being created.
	 *
	 * UNVERIFIED against a live WordPress database — see the README's
	 * staging verification checklist.
	 *
	 * @param  string $region_name
	 * @param  string $subcategory
	 * @return array {category_id: int, warnings: string[]}
	 */
	private static function get_or_create_category( $region_name, $subcategory ) {
		$warnings    = [];
		$region_name = self::sanitize_term_name( $region_name );
		$subcategory = self::sanitize_term_name( $subcategory );

		if ( '' === $region_name ) {
			return [ 'category_id' => 0, 'warnings' => $warnings ];
		}

		[ $region_id, $region_warning ] = self::get_or_create_term( $region_name, 0 );
		if ( $region_warning ) {
			$warnings[] = $region_warning;
		}
		if ( ! $region_id || '' === $subcategory ) {
			return [ 'category_id' => $region_id, 'warnings' => $warnings ];
		}

		[ $sub_id, $sub_warning ] = self::get_or_create_term( $subcategory, $region_id );
		if ( $sub_warning ) {
			$warnings[] = $sub_warning;
		}

		return [ 'category_id' => $sub_id ?: $region_id, 'warnings' => $warnings ];
	}

	/**
	 * @param  string $name
	 * @param  int    $parent
	 * @return array {0: int term_id (0 on failure), 1: string|null warning}
	 */
	private static function get_or_create_term( $name, $parent ) {
		$existing = get_terms( [
			'taxonomy'   => 'category',
			'name'       => $name,
			'parent'     => $parent,
			'hide_empty' => false,
		] );
		if ( is_wp_error( $existing ) ) {
			return [ 0, sprintf( 'Category lookup failed for "%s": %s', $name, $existing->get_error_message() ) ];
		}
		if ( ! empty( $existing ) ) {
			return [ (int) $existing[0]->term_id, null ];
		}

		$created = wp_insert_term( $name, 'category', [ 'parent' => $parent ] );
		if ( ! is_wp_error( $created ) ) {
			return [ (int) $created['term_id'], null ];
		}

		// term_exists is the expected race/duplicate case — WP_Error
		// still carries the existing term_id in its error data.
		if ( 'term_exists' === $created->get_error_code() ) {
			$existing_id = $created->get_error_data( 'term_exists' );
			if ( $existing_id ) {
				return [ (int) $existing_id, null ];
			}
		}

		return [ 0, sprintf( 'Could not create category "%s": %s', $name, $created->get_error_message() ) ];
	}

	private static function sanitize_term_name( $name ) {
		$name = sanitize_text_field( (string) $name );
		return mb_substr( trim( $name ), 0, 200 );
	}

	/* =========================================================
	   ACTION: REJECT
	========================================================= */

	public static function handle_reject() {
		$candidate_id = absint( $_POST['candidate_id'] ?? 0 );
		check_admin_referer( 'hln_reject_' . $candidate_id );

		wp_update_post( [ 'ID' => $candidate_id, 'post_status' => 'hln_rejected' ] );
		HLN_Candidate_CPT::append_audit( $candidate_id, 'review_rejected', 'Reviewer rejected candidate.' );

		wp_safe_redirect( admin_url( 'admin.php?page=hln-dashboard&hln_notice=' . rawurlencode( __( 'Candidate rejected.', 'hl-newsroom' ) ) ) );
		exit;
	}
}
