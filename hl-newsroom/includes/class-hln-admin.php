<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class HLN_Admin {

	/**
	 * Static list of story types templates will exist for from Phase 5
	 * onward. Used here only to collect an is_premium default per type —
	 * no template logic exists yet in this phase.
	 */
	const STORY_TYPES = [ 'news', 'preview', 'result', 'feature', 'breeding', 'industry' ];

	public function __construct() {
		add_action( 'admin_menu',            [ $this, 'register_menus' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
	}

	/* =========================================================
	   MENUS
	========================================================= */

	public function register_menus() {
		add_menu_page(
			__( 'HarnessLink Newsroom', 'hl-newsroom' ),
			__( 'HarnessLink Newsroom', 'hl-newsroom' ),
			'manage_options',
			'hl-newsroom',
			[ $this, 'page_dashboard' ],
			'dashicons-megaphone',
			30
		);

		add_submenu_page(
			'hl-newsroom',
			__( 'Dashboard', 'hl-newsroom' ),
			__( 'Dashboard', 'hl-newsroom' ),
			'manage_options',
			'hl-newsroom',
			[ $this, 'page_dashboard' ]
		);

		add_submenu_page(
			'hl-newsroom',
			__( 'Sources', 'hl-newsroom' ),
			__( 'Sources', 'hl-newsroom' ),
			'manage_options',
			'hln-sources',
			[ $this, 'page_sources' ]
		);

		add_submenu_page(
			'hl-newsroom',
			__( 'Verified Social (X)', 'hl-newsroom' ),
			__( 'Verified Social (X)', 'hl-newsroom' ),
			'manage_options',
			'hln-verified-social',
			[ $this, 'page_verified_social' ]
		);

		add_submenu_page(
			'hl-newsroom',
			__( 'Settings', 'hl-newsroom' ),
			__( 'Settings', 'hl-newsroom' ),
			'manage_options',
			'hln-settings',
			[ $this, 'page_settings' ]
		);

		add_submenu_page(
			'hl-newsroom',
			__( 'Intake Log', 'hl-newsroom' ),
			__( 'Intake Log', 'hl-newsroom' ),
			'manage_options',
			'hln-intake-log',
			[ $this, 'page_intake_log' ]
		);

		/*
		 * Later-phase screens, added here once they exist:
		 *
		 * add_submenu_page( 'hl-newsroom', __( 'Story Candidates', 'hl-newsroom' ), __( 'Story Candidates', 'hl-newsroom' ), 'manage_options', 'edit.php?post_type=hln_candidate' ); // Phase 4
		 * add_submenu_page( 'hl-newsroom', __( 'Editorial Dashboard', 'hl-newsroom' ), __( 'Editorial Dashboard', 'hl-newsroom' ), 'manage_options', 'hln-dashboard', [ $this, 'page_editorial_dashboard' ] ); // Phase 6
		 */
	}

	/* =========================================================
	   PAGE: INTAKE LOG  (Phase 2 — extends this admin shell)
	========================================================= */

	public function page_intake_log() {
		$tab     = isset( $_GET['tab'] ) ? sanitize_text_field( wp_unslash( $_GET['tab'] ) ) : 'all';
		$channel = isset( $_GET['channel'] ) ? sanitize_text_field( wp_unslash( $_GET['channel'] ) ) : '';

		$counts  = HLN_Intake_Log::counts_by_status();
		$filters = 'all' === $tab ? [] : [ 'status' => $tab ];
		if ( '' !== $channel ) {
			$filters['channel'] = $channel;
		}
		$items = HLN_Intake_Log::get_recent( 100, $filters );

		$tabs = [
			'all'          => sprintf( __( 'All (%d)', 'hl-newsroom' ), array_sum( $counts ) ),
			'processed'    => sprintf( __( 'Processed (%d)', 'hl-newsroom' ), $counts['processed'] ),
			'unclassified' => sprintf( __( 'Unclassified (%d)', 'hl-newsroom' ), $counts['unclassified'] ),
			'quarantined'  => sprintf( __( 'Quarantined (%d)', 'hl-newsroom' ), $counts['quarantined'] ),
		];
		$channels = [ '' => __( 'All Channels', 'hl-newsroom' ), 'email' => 'Email', 'race-data' => 'Race Data', 'rss' => 'RSS', 'x' => 'X' ];
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-list-view"></span> <?php _e( 'Intake Log', 'hl-newsroom' ); ?></h1>

			<h2 class="nav-tab-wrapper">
				<?php foreach ( $tabs as $key => $label ) : ?>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-intake-log&tab=' . $key . '&channel=' . rawurlencode( $channel ) ) ); ?>" class="nav-tab <?php echo $tab === $key ? 'nav-tab-active' : ''; ?>"><?php echo esc_html( $label ); ?></a>
				<?php endforeach; ?>
			</h2>

			<form method="get" action="" style="margin: 12px 0;">
				<input type="hidden" name="page" value="hln-intake-log" />
				<input type="hidden" name="tab" value="<?php echo esc_attr( $tab ); ?>" />
				<label for="hln-channel-filter"><?php _e( 'Channel:', 'hl-newsroom' ); ?></label>
				<select name="channel" id="hln-channel-filter" onchange="this.form.submit()">
					<?php foreach ( $channels as $value => $label ) : ?>
						<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $channel, $value ); ?>><?php echo esc_html( $label ); ?></option>
					<?php endforeach; ?>
				</select>
			</form>

			<div class="hln-panel">
				<table class="wp-list-table widefat fixed striped">
					<thead>
						<tr>
							<th><?php _e( 'Ingested', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Channel', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Status', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Source', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Headline', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Data Type', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Flags', 'hl-newsroom' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php if ( empty( $items ) ) : ?>
							<tr><td colspan="7"><?php _e( 'No items yet.', 'hl-newsroom' ); ?></td></tr>
						<?php else : ?>
							<?php foreach ( $items as $item ) : ?>
								<tr>
									<td><?php echo esc_html( $item->ingested_at ); ?></td>
									<td><?php echo esc_html( $item->channel ); ?></td>
									<td><span class="hln-badge hln-badge-<?php echo esc_attr( 'processed' === $item->status ? 'on' : 'off' ); ?>"><?php echo esc_html( $item->status ); ?></span></td>
									<td><?php echo esc_html( $item->source_name ?: '—' ); ?></td>
									<td>
										<?php echo esc_html( $item->headline ?: '—' ); ?>
										<?php if ( $item->reason ) : ?><br><span class="description"><?php echo esc_html( $item->reason ); ?></span><?php endif; ?>
									</td>
									<td><?php echo esc_html( $item->data_type ?: '—' ); ?></td>
									<td>
										<?php if ( ! empty( $item->requires_source_clearance ) ) : ?><span class="hln-badge hln-badge-off"><?php _e( 'Clearance Required', 'hl-newsroom' ); ?></span><?php endif; ?>
										<?php if ( ! empty( $item->verify_against_official ) ) : ?><span class="hln-badge hln-badge-off"><?php _e( 'Verify vs Official', 'hl-newsroom' ); ?></span><?php endif; ?>
										<?php if ( $item->confirm_status ) : ?><span class="hln-badge hln-badge-off"><?php echo esc_html( $item->confirm_status ); ?></span><?php endif; ?>
									</td>
								</tr>
							<?php endforeach; ?>
						<?php endif; ?>
					</tbody>
				</table>
			</div>

			<div class="hln-panel">
				<h2><?php _e( 'Feature Race Calendar', 'hl-newsroom' ); ?></h2>
				<?php $this->render_calendar_table(); ?>
			</div>
		</div>
		<?php
	}

	private function render_calendar_table() {
		global $wpdb;
		$table = $wpdb->prefix . 'hln_race_calendar';
		$rows  = $wpdb->get_results( "SELECT * FROM $table ORDER BY race_date ASC LIMIT 50" );
		?>
		<table class="wp-list-table widefat fixed striped">
			<thead>
				<tr>
					<th><?php _e( 'Race', 'hl-newsroom' ); ?></th>
					<th><?php _e( 'Governing Body', 'hl-newsroom' ); ?></th>
					<th><?php _e( 'Region', 'hl-newsroom' ); ?></th>
					<th><?php _e( 'Date', 'hl-newsroom' ); ?></th>
					<th><?php _e( 'Grade', 'hl-newsroom' ); ?></th>
					<th><?php _e( 'Prize Money', 'hl-newsroom' ); ?></th>
					<th><?php _e( 'Intelligence', 'hl-newsroom' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php if ( empty( $rows ) ) : ?>
					<tr><td colspan="7"><?php _e( 'No calendar entries yet.', 'hl-newsroom' ); ?></td></tr>
				<?php else : ?>
					<?php foreach ( $rows as $row ) : $intel = HLN_Racing_Intelligence::get_for_entry( (int) $row->id ); ?>
						<tr>
							<td><?php echo esc_html( $row->race_name ); ?></td>
							<td><?php echo esc_html( $row->governing_body ); ?></td>
							<td><?php echo esc_html( $row->region ); ?></td>
							<td><?php echo esc_html( $row->race_date ?: '—' ); ?></td>
							<td><?php echo esc_html( $row->grade ?: '—' ); ?></td>
							<td><?php echo esc_html( $row->prize_money ?: '—' ); ?></td>
							<td><?php echo $intel ? esc_html__( 'Assembled', 'hl-newsroom' ) : esc_html__( 'Not yet', 'hl-newsroom' ); ?></td>
						</tr>
					<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>
		<?php
	}

	/* =========================================================
	   ASSETS
	========================================================= */

	public function enqueue_assets( $hook ) {
		$is_our_page = strpos( $hook, 'hl-newsroom' ) !== false
					|| strpos( $hook, 'hln-' ) !== false;

		if ( ! $is_our_page ) return;

		wp_enqueue_style( 'hln-admin', HLN_PLUGIN_URL . 'assets/css/admin.css', [], HLN_VERSION );
		wp_enqueue_script( 'hln-admin', HLN_PLUGIN_URL . 'assets/js/admin.js', [ 'jquery' ], HLN_VERSION, true );
	}

	/* =========================================================
	   PAGE: DASHBOARD
	========================================================= */

	public function page_dashboard() {
		$flat        = HLN_Sources::all_flat();
		$total       = count( $flat );
		$enabled     = count( array_filter( $flat, fn( $s ) => ! empty( $s['enabled'] ) ) );
		$auto_publish = count( array_filter( $flat, fn( $s ) => ! empty( $s['auto_publish'] ) ) );
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-megaphone"></span> <?php _e( 'HarnessLink Newsroom', 'hl-newsroom' ); ?></h1>

			<div class="hln-stats-grid">
				<div class="hln-stat-card">
					<div class="hln-stat-icon dashicons dashicons-admin-site-alt3"></div>
					<div class="hln-stat-value"><?php echo (int) $total; ?></div>
					<div class="hln-stat-label"><?php _e( 'Registered Sources', 'hl-newsroom' ); ?></div>
				</div>
				<div class="hln-stat-card">
					<div class="hln-stat-icon dashicons dashicons-yes-alt"></div>
					<div class="hln-stat-value"><?php echo (int) $enabled; ?></div>
					<div class="hln-stat-label"><?php _e( 'Enabled', 'hl-newsroom' ); ?></div>
				</div>
				<div class="hln-stat-card">
					<div class="hln-stat-icon dashicons dashicons-warning"></div>
					<div class="hln-stat-value"><?php echo (int) $auto_publish; ?></div>
					<div class="hln-stat-label"><?php _e( 'Auto-Publish Enabled', 'hl-newsroom' ); ?></div>
				</div>
			</div>

			<div class="hln-panel">
				<h2><?php _e( 'About This Screen', 'hl-newsroom' ); ?></h2>
				<p class="description">
					<?php _e( 'This is the plugin bootstrap and Source Registry only. Intake, triage, story generation, and the editorial review dashboard are built in later phases and will appear here as they land.', 'hl-newsroom' ); ?>
				</p>
				<p>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-sources' ) ); ?>" class="button button-primary"><?php _e( 'Manage Sources', 'hl-newsroom' ); ?></a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-settings' ) ); ?>" class="button"><?php _e( 'Settings', 'hl-newsroom' ); ?></a>
				</p>
			</div>
		</div>
		<?php
	}

	/* =========================================================
	   PAGE: SOURCES
	========================================================= */

	public function page_sources() {
		$notice = '';

		if ( isset( $_POST['hln_save_source'] ) ) {
			check_admin_referer( 'hln_save_source_nonce' );
			$this->save_source_from_post();
			$notice = __( 'Source saved.', 'hl-newsroom' );
		} elseif ( isset( $_POST['hln_toggle_source'] ) ) {
			check_admin_referer( 'hln_toggle_source_nonce' );
			$type = sanitize_text_field( wp_unslash( $_POST['hln_type'] ?? '' ) );
			$slug = sanitize_text_field( wp_unslash( $_POST['hln_slug'] ?? '' ) );
			$enabled = ! empty( $_POST['hln_new_enabled'] );
			if ( in_array( $type, HLN_Sources::SOURCE_TYPES, true ) && '' !== $slug ) {
				HLN_Sources::set_enabled( $type, $slug, $enabled );
				$notice = $enabled ? __( 'Source enabled.', 'hl-newsroom' ) : __( 'Source disabled.', 'hl-newsroom' );
			}
		}

		$edit_key    = isset( $_GET['edit'] ) ? sanitize_text_field( wp_unslash( $_GET['edit'] ) ) : '';
		$edit_entry  = null;
		if ( '' !== $edit_key && false !== strpos( $edit_key, ':' ) ) {
			[ $edit_type, $edit_slug ] = explode( ':', $edit_key, 2 );
			$edit_entry = HLN_Sources::get( $edit_type, $edit_slug );
		}

		$all = HLN_Sources::all_flat();
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-admin-site-alt3"></span> <?php _e( 'Sources', 'hl-newsroom' ); ?></h1>

			<?php if ( $notice ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>

			<div class="hln-panel">
				<h2><?php echo $edit_entry ? esc_html__( 'Edit Source', 'hl-newsroom' ) : esc_html__( 'Add Source', 'hl-newsroom' ); ?></h2>
				<form method="post" action="">
					<?php wp_nonce_field( 'hln_save_source_nonce' ); ?>
					<input type="hidden" name="hln_save_source" value="1" />
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-slug"><?php _e( 'Slug', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_slug" id="hln-slug" class="regular-text" pattern="[a-z0-9_]+"
									value="<?php echo esc_attr( $edit_entry ? $edit_slug : '' ); ?>"
									<?php echo $edit_entry ? 'readonly' : ''; ?> required />
								<p class="description"><?php _e( 'Lowercase letters, numbers, underscores only. Cannot be changed after a source is created.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
						<tr>
							<th><label for="hln-label"><?php _e( 'Label', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_label" id="hln-label" class="regular-text" value="<?php echo esc_attr( $edit_entry['label'] ?? '' ); ?>" required /></td>
						</tr>
						<tr>
							<th><label for="hln-type"><?php _e( 'Source Type', 'hl-newsroom' ); ?></label></th>
							<td>
								<select name="hln_type" id="hln-type">
									<?php foreach ( HLN_Sources::SOURCE_TYPES as $type ) : ?>
										<option value="<?php echo esc_attr( $type ); ?>" <?php selected( $edit_entry ? $edit_type : '', $type ); ?>><?php echo esc_html( $type ); ?></option>
									<?php endforeach; ?>
								</select>
							</td>
						</tr>
						<tr>
							<th><label for="hln-region"><?php _e( 'Region', 'hl-newsroom' ); ?></label></th>
							<td>
								<select name="hln_region" id="hln-region">
									<?php foreach ( HLN_Sources::REGIONS as $region ) : ?>
										<option value="<?php echo esc_attr( $region ); ?>" <?php selected( $edit_entry['region'] ?? '', $region ); ?>><?php echo esc_html( $region ); ?></option>
									<?php endforeach; ?>
								</select>
							</td>
						</tr>
						<tr>
							<th><label for="hln-url"><?php _e( 'URL', 'hl-newsroom' ); ?></label></th>
							<td><input type="url" name="hln_url" id="hln-url" class="regular-text" value="<?php echo esc_attr( $edit_entry['url'] ?? '' ); ?>" /></td>
						</tr>
						<tr>
							<th><label for="hln-ingestion-method"><?php _e( 'Ingestion Method', 'hl-newsroom' ); ?></label></th>
							<td>
								<select name="hln_ingestion_method" id="hln-ingestion-method">
									<?php foreach ( [ 'api', 'rss', 'email', 'monitored-page', 'x-api' ] as $method ) : ?>
										<option value="<?php echo esc_attr( $method ); ?>" <?php selected( $edit_entry['ingestion_method'] ?? 'monitored-page', $method ); ?>><?php echo esc_html( $method ); ?></option>
									<?php endforeach; ?>
								</select>
							</td>
						</tr>
						<tr>
							<th><label for="hln-trust-score"><?php _e( 'Trust Score', 'hl-newsroom' ); ?></label></th>
							<td><input type="number" name="hln_trust_score" id="hln-trust-score" min="0" max="100" class="small-text" value="<?php echo esc_attr( $edit_entry['trust_score'] ?? 50 ); ?>" /></td>
						</tr>
						<tr>
							<th><label for="hln-check-frequency"><?php _e( 'Check Frequency', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_check_frequency" id="hln-check-frequency" class="small-text" placeholder="30m" value="<?php echo esc_attr( $edit_entry['check_frequency'] ?? '1h' ); ?>" />
								<p class="description"><?php _e( 'e.g. 15m, 30m, 1h, 6h.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
						<tr>
							<th><label for="hln-governing-body"><?php _e( 'Governing Body', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_governing_body" id="hln-governing-body" class="regular-text" value="<?php echo esc_attr( $edit_entry['governing_body'] ?? '' ); ?>" /></td>
						</tr>
						<tr>
							<th><?php _e( 'Auto-Publish', 'hl-newsroom' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="hln_auto_publish" value="1" <?php checked( ! empty( $edit_entry['auto_publish'] ) ); ?> />
									<?php _e( 'Allow this source to reach the Tier-1 fast-path (still requires the global and per-source kill switch to be off, and never bypasses a human Publish action — see Phase 6).', 'hl-newsroom' ); ?>
								</label>
							</td>
						</tr>
						<tr>
							<th><?php _e( 'Enabled', 'hl-newsroom' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="hln_enabled" value="1" <?php checked( $edit_entry ? ! empty( $edit_entry['enabled'] ) : true ); ?> />
									<?php _e( 'Source is active', 'hl-newsroom' ); ?>
								</label>
							</td>
						</tr>
					</table>
					<p class="submit">
						<button type="submit" class="button button-primary"><?php echo $edit_entry ? esc_html__( 'Save Changes', 'hl-newsroom' ) : esc_html__( 'Add Source', 'hl-newsroom' ); ?></button>
						<?php if ( $edit_entry ) : ?>
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-sources' ) ); ?>" class="button"><?php _e( 'Cancel', 'hl-newsroom' ); ?></a>
						<?php endif; ?>
					</p>
				</form>
			</div>

			<div class="hln-panel">
				<h2><?php _e( 'Registry', 'hl-newsroom' ); ?></h2>
				<table class="wp-list-table widefat fixed striped hln-sources-table">
					<thead>
						<tr>
							<th><?php _e( 'Label', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Type', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Region', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Ingestion', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Trust', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Check Frequency', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Auto-Publish', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Status', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Actions', 'hl-newsroom' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php if ( empty( $all ) ) : ?>
							<tr><td colspan="9"><?php _e( 'No sources registered yet.', 'hl-newsroom' ); ?></td></tr>
						<?php else : ?>
							<?php foreach ( $all as $key => $entry ) : ?>
								<tr>
									<td><strong><?php echo esc_html( $entry['label'] ); ?></strong></td>
									<td><?php echo esc_html( $entry['source_type'] ); ?></td>
									<td><?php echo esc_html( $entry['region'] ); ?></td>
									<td><?php echo esc_html( $entry['ingestion_method'] ); ?></td>
									<td><?php echo esc_html( $entry['trust_score'] ); ?></td>
									<td><?php echo esc_html( $entry['check_frequency'] ); ?></td>
									<td><?php echo ! empty( $entry['auto_publish'] ) ? esc_html__( 'On', 'hl-newsroom' ) : esc_html__( 'Off', 'hl-newsroom' ); ?></td>
									<td>
										<span class="hln-badge <?php echo ! empty( $entry['enabled'] ) ? 'hln-badge-on' : 'hln-badge-off'; ?>">
											<?php echo ! empty( $entry['enabled'] ) ? esc_html__( 'Enabled', 'hl-newsroom' ) : esc_html__( 'Disabled', 'hl-newsroom' ); ?>
										</span>
									</td>
									<td>
										<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-sources&edit=' . rawurlencode( $key ) ) ); ?>"><?php _e( 'Edit', 'hl-newsroom' ); ?></a>
										&nbsp;|&nbsp;
										<form method="post" action="" style="display:inline;">
											<?php wp_nonce_field( 'hln_toggle_source_nonce' ); ?>
											<input type="hidden" name="hln_toggle_source" value="1" />
											<input type="hidden" name="hln_type" value="<?php echo esc_attr( $entry['_type'] ); ?>" />
											<input type="hidden" name="hln_slug" value="<?php echo esc_attr( $entry['_slug'] ); ?>" />
											<input type="hidden" name="hln_new_enabled" value="<?php echo ! empty( $entry['enabled'] ) ? '0' : '1'; ?>" />
											<button type="submit" class="button-link">
												<?php echo ! empty( $entry['enabled'] ) ? esc_html__( 'Disable', 'hl-newsroom' ) : esc_html__( 'Enable', 'hl-newsroom' ); ?>
											</button>
										</form>
									</td>
								</tr>
							<?php endforeach; ?>
						<?php endif; ?>
					</tbody>
				</table>
			</div>
		</div>
		<?php
	}

	private function save_source_from_post() {
		$type = sanitize_text_field( wp_unslash( $_POST['hln_type'] ?? '' ) );
		$slug = sanitize_key( wp_unslash( $_POST['hln_slug'] ?? '' ) );

		if ( ! in_array( $type, HLN_Sources::SOURCE_TYPES, true ) || '' === $slug ) {
			return;
		}

		$fields = [
			'label'            => sanitize_text_field( wp_unslash( $_POST['hln_label'] ?? '' ) ),
			'region'           => sanitize_text_field( wp_unslash( $_POST['hln_region'] ?? '' ) ),
			'source_type'      => $type,
			'url'              => esc_url_raw( wp_unslash( $_POST['hln_url'] ?? '' ) ),
			'ingestion_method' => sanitize_text_field( wp_unslash( $_POST['hln_ingestion_method'] ?? 'monitored-page' ) ),
			'trust_score'      => max( 0, min( 100, absint( $_POST['hln_trust_score'] ?? 50 ) ) ),
			'check_frequency'  => sanitize_text_field( wp_unslash( $_POST['hln_check_frequency'] ?? '1h' ) ),
			'auto_publish'     => ! empty( $_POST['hln_auto_publish'] ),
			'governing_body'   => sanitize_text_field( wp_unslash( $_POST['hln_governing_body'] ?? '' ) ) ?: null,
			'enabled'          => ! empty( $_POST['hln_enabled'] ),
		];

		HLN_Sources::save_override( $type, $slug, $fields );
	}

	/* =========================================================
	   PAGE: VERIFIED SOCIAL (X) ALLOW-LIST
	========================================================= */

	public function page_verified_social() {
		$notice = '';

		if ( isset( $_POST['hln_save_verified_social'] ) ) {
			check_admin_referer( 'hln_save_verified_social_nonce' );
			$this->save_verified_social_from_post();
			$notice = __( 'Account saved.', 'hl-newsroom' );
		} elseif ( isset( $_POST['hln_toggle_verified_social'] ) ) {
			check_admin_referer( 'hln_toggle_verified_social_nonce' );
			$handle = sanitize_text_field( wp_unslash( $_POST['hln_handle'] ?? '' ) );
			if ( '' !== $handle ) {
				HLN_Sources::set_verified_social_enabled( $handle, ! empty( $_POST['hln_new_enabled'] ) );
				$notice = __( 'Account updated.', 'hl-newsroom' );
			}
		}

		$edit_handle = isset( $_GET['edit'] ) ? sanitize_text_field( wp_unslash( $_GET['edit'] ) ) : '';
		$edit_entry  = $edit_handle ? HLN_Sources::get_verified_social_account( $edit_handle ) : null;

		$accounts = HLN_Sources::get_verified_social_accounts();
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-twitter"></span> <?php _e( 'Verified Social (X) Allow-List', 'hl-newsroom' ); ?></h1>
			<p class="description"><?php _e( 'A narrow, explicitly-vetted list by design (spec §2.3). Never add a handle here without individually confirming it is the real, named account for the entity it claims to be — this list is not a place for keyword or hashtag search.', 'hl-newsroom' ); ?></p>

			<?php if ( $notice ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>

			<div class="hln-panel">
				<h2><?php echo $edit_entry ? esc_html__( 'Edit Account', 'hl-newsroom' ) : esc_html__( 'Add Account', 'hl-newsroom' ); ?></h2>
				<form method="post" action="">
					<?php wp_nonce_field( 'hln_save_verified_social_nonce' ); ?>
					<input type="hidden" name="hln_save_verified_social" value="1" />
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-handle"><?php _e( 'Handle', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_handle" id="hln-handle" class="regular-text" placeholder="USTAracing"
									value="<?php echo esc_attr( $edit_handle ); ?>" <?php echo $edit_entry ? 'readonly' : ''; ?> required />
								<p class="description"><?php _e( 'Without the @ sign. Cannot be changed after adding — disable and re-add instead.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
						<tr>
							<th><label for="hln-owning-entity"><?php _e( 'Owning Entity', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_owning_entity" id="hln-owning-entity" class="regular-text" value="<?php echo esc_attr( $edit_entry['owning_entity'] ?? '' ); ?>" required /></td>
						</tr>
						<tr>
							<th><label for="hln-verification-method"><?php _e( 'Verification Method', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_verification_method" id="hln-verification-method" class="regular-text" placeholder="<?php esc_attr_e( 'e.g. linked from the official body\'s own site', 'hl-newsroom' ); ?>" value="<?php echo esc_attr( $edit_entry['verification_method'] ?? '' ); ?>" required />
								<p class="description"><?php _e( 'How this was confirmed as the real, named account — required for every entry.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
						<tr>
							<th><label for="hln-vs-region"><?php _e( 'Region', 'hl-newsroom' ); ?></label></th>
							<td>
								<select name="hln_region" id="hln-vs-region">
									<option value=""><?php _e( '— None —', 'hl-newsroom' ); ?></option>
									<?php foreach ( HLN_Sources::REGIONS as $region ) : ?>
										<option value="<?php echo esc_attr( $region ); ?>" <?php selected( $edit_entry['region'] ?? '', $region ); ?>><?php echo esc_html( $region ); ?></option>
									<?php endforeach; ?>
								</select>
							</td>
						</tr>
						<tr>
							<th><label for="hln-vs-check-frequency"><?php _e( 'Check Frequency', 'hl-newsroom' ); ?></label></th>
							<td><input type="text" name="hln_check_frequency" id="hln-vs-check-frequency" class="small-text" value="<?php echo esc_attr( $edit_entry['check_frequency'] ?? '15m' ); ?>" /></td>
						</tr>
						<tr>
							<th><?php _e( 'Enabled', 'hl-newsroom' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="hln_enabled" value="1" <?php checked( $edit_entry ? ! empty( $edit_entry['enabled'] ) : true ); ?> />
									<?php _e( 'Account is active', 'hl-newsroom' ); ?>
								</label>
							</td>
						</tr>
					</table>
					<p class="submit">
						<button type="submit" class="button button-primary"><?php echo $edit_entry ? esc_html__( 'Save Changes', 'hl-newsroom' ) : esc_html__( 'Add Account', 'hl-newsroom' ); ?></button>
						<?php if ( $edit_entry ) : ?>
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-verified-social' ) ); ?>" class="button"><?php _e( 'Cancel', 'hl-newsroom' ); ?></a>
						<?php endif; ?>
					</p>
				</form>
			</div>

			<div class="hln-panel">
				<h2><?php _e( 'Allow-List', 'hl-newsroom' ); ?></h2>
				<table class="wp-list-table widefat fixed striped">
					<thead>
						<tr>
							<th><?php _e( 'Handle', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Owning Entity', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Verification Method', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Region', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Date Added', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Status', 'hl-newsroom' ); ?></th>
							<th><?php _e( 'Actions', 'hl-newsroom' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php if ( empty( $accounts ) ) : ?>
							<tr><td colspan="7"><?php _e( 'No accounts added yet.', 'hl-newsroom' ); ?></td></tr>
						<?php else : ?>
							<?php foreach ( $accounts as $handle => $account ) : ?>
								<tr>
									<td><strong>@<?php echo esc_html( $handle ); ?></strong></td>
									<td><?php echo esc_html( $account['owning_entity'] ); ?></td>
									<td><?php echo esc_html( $account['verification_method'] ); ?></td>
									<td><?php echo esc_html( $account['region'] ); ?></td>
									<td><?php echo esc_html( $account['date_added'] ); ?></td>
									<td>
										<span class="hln-badge <?php echo ! empty( $account['enabled'] ) ? 'hln-badge-on' : 'hln-badge-off'; ?>">
											<?php echo ! empty( $account['enabled'] ) ? esc_html__( 'Enabled', 'hl-newsroom' ) : esc_html__( 'Disabled', 'hl-newsroom' ); ?>
										</span>
									</td>
									<td>
										<a href="<?php echo esc_url( admin_url( 'admin.php?page=hln-verified-social&edit=' . rawurlencode( $handle ) ) ); ?>"><?php _e( 'Edit', 'hl-newsroom' ); ?></a>
										&nbsp;|&nbsp;
										<form method="post" action="" style="display:inline;">
											<?php wp_nonce_field( 'hln_toggle_verified_social_nonce' ); ?>
											<input type="hidden" name="hln_toggle_verified_social" value="1" />
											<input type="hidden" name="hln_handle" value="<?php echo esc_attr( $handle ); ?>" />
											<input type="hidden" name="hln_new_enabled" value="<?php echo ! empty( $account['enabled'] ) ? '0' : '1'; ?>" />
											<button type="submit" class="button-link">
												<?php echo ! empty( $account['enabled'] ) ? esc_html__( 'Disable', 'hl-newsroom' ) : esc_html__( 'Enable', 'hl-newsroom' ); ?>
											</button>
										</form>
									</td>
								</tr>
							<?php endforeach; ?>
						<?php endif; ?>
					</tbody>
				</table>
			</div>
		</div>
		<?php
	}

	private function save_verified_social_from_post() {
		$handle = sanitize_text_field( wp_unslash( $_POST['hln_handle'] ?? '' ) );
		$handle = ltrim( $handle, '@' );
		if ( '' === $handle ) {
			return;
		}

		HLN_Sources::save_verified_social_account( $handle, [
			'owning_entity'       => sanitize_text_field( wp_unslash( $_POST['hln_owning_entity'] ?? '' ) ),
			'verification_method' => sanitize_text_field( wp_unslash( $_POST['hln_verification_method'] ?? '' ) ),
			'region'              => sanitize_text_field( wp_unslash( $_POST['hln_region'] ?? '' ) ),
			'check_frequency'     => sanitize_text_field( wp_unslash( $_POST['hln_check_frequency'] ?? '15m' ) ),
			'enabled'             => ! empty( $_POST['hln_enabled'] ),
		] );
	}

	/* =========================================================
	   PAGE: SETTINGS
	========================================================= */

	public function page_settings() {
		$notice = '';

		if ( isset( $_POST['hln_save_settings'] ) ) {
			check_admin_referer( 'hln_save_settings_nonce' );
			$this->save_settings_from_post();
			$notice = __( 'Settings saved.', 'hl-newsroom' );
		}

		$default_byline    = get_option( 'hln_default_byline', 'HarnessLink Media' );
		$regions            = get_option( 'hln_regions', "USA\nCanada\nAustralia\nNew Zealand\nEurope" );
		$subcategories       = get_option( 'hln_subcategories', "News\nEntries\nResults\nBreeding" );
		$premium_defaults   = get_option( 'hln_is_premium_defaults', [] );
		?>
		<div class="wrap hln-wrap">
			<h1 class="hln-page-title"><span class="dashicons dashicons-admin-settings"></span> <?php _e( 'Settings', 'hl-newsroom' ); ?></h1>

			<?php if ( $notice ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>

			<form method="post" action="">
				<?php wp_nonce_field( 'hln_save_settings_nonce' ); ?>
				<input type="hidden" name="hln_save_settings" value="1" />

				<div class="hln-panel">
					<h2><?php _e( 'Attribution', 'hl-newsroom' ); ?></h2>
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-default-byline"><?php _e( 'Default Byline', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_default_byline" id="hln-default-byline" class="regular-text" value="<?php echo esc_attr( $default_byline ); ?>" />
								<p class="description"><?php _e( 'Used on every generated draft unless a human sets a Published-By author at review time. Never set this to a source\'s own name.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
					</table>
				</div>

				<div class="hln-panel">
					<h2><?php _e( 'Email Intake', 'hl-newsroom' ); ?></h2>
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-inbound-email-signing-key"><?php _e( 'Inbound Webhook Signing Key', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_inbound_email_signing_key" id="hln-inbound-email-signing-key" class="regular-text code" value="<?php echo esc_attr( get_option( 'hln_inbound_email_signing_key', '' ) ); ?>" />
								<p class="description"><?php printf(
									esc_html__( 'Set to the signing key from your inbound-parse email provider (%s payload assumed — see HLN_INBOUND_EMAIL_PROVIDER). The %s endpoint rejects every request until this is set — a POSTed "sender" field is only a claim, not verified identity, until the signature check passes.', 'hl-newsroom' ),
									'<code>' . esc_html( HLN_INBOUND_EMAIL_PROVIDER ) . '</code>',
									'<code>/wp-json/hln/v1/inbound-email</code>'
								); ?></p>
							</td>
						</tr>
					</table>
				</div>

				<div class="hln-panel">
					<h2><?php _e( 'X (Twitter) API', 'hl-newsroom' ); ?></h2>
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-x-api-bearer-token"><?php _e( 'Bearer Token', 'hl-newsroom' ); ?></label></th>
							<td>
								<input type="text" name="hln_x_api_bearer_token" id="hln-x-api-bearer-token" class="regular-text code" value="<?php echo esc_attr( get_option( 'hln_x_api_bearer_token', '' ) ); ?>" />
								<p class="description"><?php _e( 'Used by both the Verified Social (X) poller and the broader trending scan. Neither does anything until this is set.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
					</table>
				</div>

				<div class="hln-panel">
					<h2><?php _e( 'Category Taxonomy', 'hl-newsroom' ); ?></h2>
					<table class="form-table hln-form-table">
						<tr>
							<th><label for="hln-regions"><?php _e( 'Regions', 'hl-newsroom' ); ?></label></th>
							<td>
								<textarea name="hln_regions" id="hln-regions" rows="5" class="regular-text code"><?php echo esc_textarea( $regions ); ?></textarea>
								<p class="description"><?php _e( 'One per line. Top-level category, matching the live site.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
						<tr>
							<th><label for="hln-subcategories"><?php _e( 'Sub-Categories', 'hl-newsroom' ); ?></label></th>
							<td>
								<textarea name="hln_subcategories" id="hln-subcategories" rows="4" class="regular-text code"><?php echo esc_textarea( $subcategories ); ?></textarea>
								<p class="description"><?php _e( 'One per line. Applied under every region.', 'hl-newsroom' ); ?></p>
							</td>
						</tr>
					</table>
				</div>

				<div class="hln-panel">
					<h2><?php _e( 'Premium Defaults by Story Type', 'hl-newsroom' ); ?></h2>
					<p class="description"><?php _e( 'is_premium is an access-tier flag, independent of category. Story types themselves are defined by templates starting in Phase 5 — this list is a fixed placeholder until then.', 'hl-newsroom' ); ?></p>
					<table class="form-table hln-form-table">
						<?php foreach ( self::STORY_TYPES as $story_type ) : ?>
							<tr>
								<th><?php echo esc_html( ucfirst( $story_type ) ); ?></th>
								<td>
									<label>
										<input type="checkbox" name="hln_is_premium_defaults[<?php echo esc_attr( $story_type ); ?>]" value="1" <?php checked( ! empty( $premium_defaults[ $story_type ] ) ); ?> />
										<?php _e( 'Premium by default', 'hl-newsroom' ); ?>
									</label>
								</td>
							</tr>
						<?php endforeach; ?>
					</table>
				</div>

				<p class="submit">
					<button type="submit" class="button button-primary"><?php _e( 'Save Settings', 'hl-newsroom' ); ?></button>
				</p>
			</form>
		</div>
		<?php
	}

	private function save_settings_from_post() {
		update_option( 'hln_default_byline', sanitize_text_field( wp_unslash( $_POST['hln_default_byline'] ?? 'HarnessLink Media' ) ) );
		update_option( 'hln_inbound_email_signing_key', sanitize_text_field( wp_unslash( $_POST['hln_inbound_email_signing_key'] ?? '' ) ) );
		update_option( 'hln_x_api_bearer_token', sanitize_text_field( wp_unslash( $_POST['hln_x_api_bearer_token'] ?? '' ) ) );
		update_option( 'hln_regions', sanitize_textarea_field( wp_unslash( $_POST['hln_regions'] ?? '' ) ) );
		update_option( 'hln_subcategories', sanitize_textarea_field( wp_unslash( $_POST['hln_subcategories'] ?? '' ) ) );

		$premium_defaults = [];
		$posted           = wp_unslash( $_POST['hln_is_premium_defaults'] ?? [] );
		foreach ( self::STORY_TYPES as $story_type ) {
			$premium_defaults[ $story_type ] = ! empty( $posted[ $story_type ] );
		}
		update_option( 'hln_is_premium_defaults', $premium_defaults );
	}
}
