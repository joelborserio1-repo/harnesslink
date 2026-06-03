<?php
/**
 * Plugin Name: HL Layout Inspector
 * Plugin URI:  https://harnesslink.com/
 * Description: Read-only diagnostic tool that fetches the rendered homepage HTML server-side, parses it with DOMDocument, and prints the DOM tree, a white-background audit, and the ad's parent chain — so you can write precise targeting CSS without fighting stale Elementor element IDs.
 * Version:     1.0.0
 * Author:      HarnessLink
 * License:     GPL-2.0-or-later
 * Requires at least: 5.0
 * Requires PHP: 7.0
 *
 * ============================================================================
 *  HL LAYOUT INSPECTOR — INSTALL & USE
 * ============================================================================
 *
 *  WHAT IT DOES
 *  ------------
 *  This plugin is a *read-only* diagnostic. It never writes to the database,
 *  never changes the front end, and never modifies a single post or option.
 *  It simply downloads the rendered HTML of your homepage from the server side
 *  (using WordPress's own wp_remote_get) and shows you the real, post-render
 *  DOM structure inside body.elementor-page-2253114 so you can see exactly
 *  which wrapper is painting that stubborn white panel and which ancestor
 *  actually wraps your ad.
 *
 *  INSTALL
 *  -------
 *  1. Put this file in its own folder named "hl-layout-inspector" containing
 *     only this file:  hl-layout-inspector/hl-layout-inspector.php
 *  2. Zip that folder so you get "hl-layout-inspector.zip".
 *       (On the file itself you can also just drop it into
 *        wp-content/plugins/ — a single-file plugin is valid WordPress.)
 *  3. In wp-admin go to Plugins > Add New > Upload Plugin, choose the zip,
 *     Install Now, then Activate.
 *
 *  USE
 *  ---
 *  1. Go to  Tools > HL Layout Inspector.
 *  2. Click "Scan Homepage". The plugin fetches https://harnesslink.com/?nocache=1
 *     server-side and parses it. (The ?nocache=1 query param is an attempt to
 *     dodge WP Rocket's cached/minified copy — see the note in the UI. If you
 *     still see minified output, purge the WP Rocket cache once and re-scan.)
 *  3. Use the three views:
 *       - DOM Tree:        full collapsible tree of every element with tag,
 *                          id, classes, data-id, data-widget_type, inline
 *                          style, background flag and nesting depth.
 *       - Background Audit: ONLY elements that look like they paint a
 *                          white / non-transparent background.
 *       - Find Ad:         the ad element(s) and the full parent chain from
 *                          the ad up to <body>.
 *  4. Click "Copy as text" to dump everything as plain text for pasting into
 *     a chat / ticket.
 *
 *  SAFETY
 *  ------
 *  - Admin only: every action is gated behind current_user_can('manage_options').
 *  - Nonce-protected: the Scan button posts a WordPress nonce that is verified
 *    before any work is done.
 *  - No external libraries: uses only DOMDocument (WordPress/PHP core).
 *
 * ============================================================================
 */

// Block direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'HL_Layout_Inspector' ) ) {

	/**
	 * Main (and only) plugin class. Everything is namespaced inside here so the
	 * single-file plugin stays self-contained and pollutes nothing global.
	 */
	final class HL_Layout_Inspector {

		/** The homepage we inspect. */
		const TARGET_URL = 'https://harnesslink.com/';

		/** The Elementor page body class that scopes the whole inspection. */
		const ROOT_BODY_CLASS = 'elementor-page-2253114';

		/** Nonce action/name used for the Scan form. */
		const NONCE_ACTION = 'hl_layout_inspector_scan';
		const NONCE_NAME   = 'hl_li_nonce';

		/** Singleton boot. */
		public static function init() {
			$self = new self();
			add_action( 'admin_menu', array( $self, 'register_menu' ) );
		}

		/**
		 * Register the Tools > HL Layout Inspector page.
		 */
		public function register_menu() {
			add_management_page(
				'HL Layout Inspector',          // Page title.
				'HL Layout Inspector',          // Menu label.
				'manage_options',               // Capability.
				'hl-layout-inspector',          // Slug.
				array( $this, 'render_page' )   // Callback.
			);
		}

		/* =====================================================================
		 *  ADMIN PAGE
		 * ===================================================================== */

		/**
		 * Render the whole admin page: intro, scan button, and (after a scan)
		 * the three result views.
		 */
		public function render_page() {

			// Hard capability gate (belt and braces on top of add_management_page).
			if ( ! current_user_can( 'manage_options' ) ) {
				wp_die( esc_html__( 'You do not have permission to view this page.', 'hl-layout-inspector' ) );
			}

			$result = null; // Will hold the parsed-scan payload.
			$error  = '';   // Human-readable error, if any.

			// Did the user click Scan? Validate the nonce before doing anything.
			if ( isset( $_POST['hl_li_scan'] ) ) {
				if ( ! isset( $_POST[ self::NONCE_NAME ] )
					|| ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ self::NONCE_NAME ] ) ), self::NONCE_ACTION )
				) {
					$error = 'Security check failed (invalid or expired nonce). Please reload and try again.';
				} else {
					$result = $this->scan_homepage();
					if ( is_wp_error( $result ) ) {
						$error  = $result->get_error_message();
						$result = null;
					}
				}
			}

			?>
			<div class="wrap">
				<h1>HL Layout Inspector</h1>

				<p style="max-width:820px;">
					Read-only diagnostic. Fetches the rendered HTML of
					<code><?php echo esc_html( self::TARGET_URL ); ?></code> server-side and shows the real DOM
					structure inside <code>body.<?php echo esc_html( self::ROOT_BODY_CLASS ); ?></code>.
					Nothing is written or changed on the site.
				</p>

				<div class="notice notice-info inline" style="max-width:820px;">
					<p>
						<strong>WP Rocket note:</strong> the fetch URL has <code>?nocache=1</code> appended to
						try to bypass the cached/minified copy. If the output still looks minified or stale,
						purge the WP Rocket cache once and re-scan. The HTML you see here is whatever the server
						returns to a logged-out visitor.
					</p>
				</div>

				<?php if ( $error ) : ?>
					<div class="notice notice-error"><p><?php echo esc_html( $error ); ?></p></div>
				<?php endif; ?>

				<form method="post" style="margin:18px 0;">
					<?php wp_nonce_field( self::NONCE_ACTION, self::NONCE_NAME ); ?>
					<button type="submit" name="hl_li_scan" value="1" class="button button-primary button-hero">
						Scan Homepage
					</button>
					<?php if ( $result ) : ?>
						<button type="button" class="button button-hero" id="hl-li-copy" style="margin-left:8px;">
							Copy as text
						</button>
						<span id="hl-li-copy-status" style="margin-left:10px;color:#1a7f37;font-weight:600;"></span>
					<?php endif; ?>
				</form>

				<?php
				if ( $result ) {
					$this->render_results( $result );
				}
				?>
			</div>

			<?php
			$this->print_styles();
			$this->print_script();
		}

		/* =====================================================================
		 *  SCAN + PARSE
		 * ===================================================================== */

		/**
		 * Fetch the homepage and parse it into a flat list of node descriptors.
		 *
		 * @return array|WP_Error {
		 *     @type array  $nodes      Flat, pre-order list of node descriptors.
		 *     @type string $fetched_url The exact URL fetched.
		 *     @type int    $http_code   HTTP status code returned.
		 *     @type bool   $root_found  Whether body.elementor-page-2253114 was found.
		 * }
		 */
		private function scan_homepage() {

			// Cache-buster query param to try to dodge WP Rocket's static copy.
			$url = add_query_arg( 'nocache', '1', self::TARGET_URL );

			$response = wp_remote_get(
				$url,
				array(
					'timeout'     => 20,
					'redirection' => 5,
					// Pretend to be a normal browser so caches/themes don't serve a stripped variant.
					'user-agent'  => 'Mozilla/5.0 (compatible; HL-Layout-Inspector/1.0; +https://harnesslink.com)',
					'headers'     => array(
						// Ask intermediaries not to hand us a cached representation.
						'Cache-Control' => 'no-cache',
						'Pragma'        => 'no-cache',
					),
				)
			);

			if ( is_wp_error( $response ) ) {
				return new WP_Error(
					'hl_li_fetch_failed',
					'Could not fetch the homepage: ' . $response->get_error_message()
				);
			}

			$code = (int) wp_remote_retrieve_response_code( $response );
			$body = wp_remote_retrieve_body( $response );

			if ( '' === trim( (string) $body ) ) {
				return new WP_Error( 'hl_li_empty', 'The homepage returned an empty response body (HTTP ' . $code . ').' );
			}

			// Parse with DOMDocument. Suppress libxml warnings about HTML5 tags.
			$nodes      = array();
			$root_found = false;

			$prev_libxml = libxml_use_internal_errors( true );
			$dom         = new DOMDocument();

			// Force UTF-8 handling. The meta hint keeps DOMDocument from mangling
			// multibyte characters; loadHTML otherwise assumes ISO-8859-1.
			$loaded = $dom->loadHTML(
				'<?xml encoding="UTF-8">' . $body,
				LIBXML_NOWARNING | LIBXML_NOERROR
			);

			libxml_clear_errors();
			libxml_use_internal_errors( $prev_libxml );

			if ( ! $loaded ) {
				return new WP_Error( 'hl_li_parse_failed', 'DOMDocument could not parse the returned HTML.' );
			}

			// Locate the scoping root: body.elementor-page-2253114.
			$root = $this->find_root_element( $dom );

			if ( $root ) {
				$root_found = true;
				// Walk the root itself + all descendants in document (pre-order) order.
				$this->walk( $root, 0, $nodes );
			} else {
				// Fallback: if the specific Elementor body class isn't present,
				// walk the <body> so the tool still returns something useful.
				$bodies = $dom->getElementsByTagName( 'body' );
				if ( $bodies->length > 0 ) {
					$this->walk( $bodies->item( 0 ), 0, $nodes );
				}
			}

			return array(
				'nodes'       => $nodes,
				'fetched_url' => $url,
				'http_code'   => $code,
				'root_found'  => $root_found,
			);
		}

		/**
		 * Find <body> with class elementor-page-2253114 (or the <body> whose
		 * class list contains it). Returns the element or null.
		 *
		 * @param DOMDocument $dom Parsed document.
		 * @return DOMElement|null
		 */
		private function find_root_element( DOMDocument $dom ) {
			$bodies = $dom->getElementsByTagName( 'body' );
			foreach ( $bodies as $body ) {
				$classes = $this->class_list( $body );
				if ( in_array( self::ROOT_BODY_CLASS, $classes, true ) ) {
					return $body;
				}
			}
			return null;
		}

		/**
		 * Recursively walk an element subtree in pre-order, appending a flat
		 * descriptor for every *element* node (text/comment nodes are skipped).
		 *
		 * @param DOMNode $node  Current node.
		 * @param int     $depth Nesting depth relative to the walk root.
		 * @param array   $out   Accumulator (by reference).
		 */
		private function walk( DOMNode $node, $depth, array &$out ) {
			if ( XML_ELEMENT_NODE === $node->nodeType ) {
				$out[] = $this->describe( $node, $depth );
				$child_depth = $depth + 1;
			} else {
				$child_depth = $depth;
			}

			if ( $node->hasChildNodes() ) {
				foreach ( $node->childNodes as $child ) {
					if ( XML_ELEMENT_NODE === $child->nodeType ) {
						$this->walk( $child, $child_depth, $out );
					}
				}
			}
		}

		/**
		 * Build a flat descriptor array for a single element.
		 *
		 * @param DOMElement $el    Element.
		 * @param int        $depth Nesting depth.
		 * @return array
		 */
		private function describe( DOMElement $el, $depth ) {
			$id            = $el->getAttribute( 'id' );
			$class         = $el->getAttribute( 'class' );
			$data_id       = $el->getAttribute( 'data-id' );
			$widget_type   = $el->getAttribute( 'data-widget_type' );
			$style         = $el->getAttribute( 'style' );
			$data_settings = $el->getAttribute( 'data-settings' );

			return array(
				'tag'          => strtolower( $el->nodeName ),
				'id'           => $id,
				'class'        => $class,
				'data_id'      => $data_id,
				'widget_type'  => $widget_type,
				'style'        => $style,
				'has_bg'       => $this->has_background( $style, $data_settings ),
				'is_white_bg'  => $this->looks_white_bg( $style, $data_settings, $class ),
				'depth'        => (int) $depth,
			);
		}

		/* =====================================================================
		 *  BACKGROUND HEURISTICS
		 * ===================================================================== */

		/**
		 * Does this element appear to carry *any* Elementor / inline background?
		 * True if data-settings declares a background_background, or the inline
		 * style sets a background-color that is not transparent/none.
		 *
		 * @param string $style         Inline style attribute.
		 * @param string $data_settings data-settings attribute (Elementor JSON).
		 * @return bool
		 */
		private function has_background( $style, $data_settings ) {
			if ( '' !== $data_settings && false !== strpos( $data_settings, 'background_background' ) ) {
				return true;
			}
			$bg = $this->inline_background_color( $style );
			if ( '' === $bg ) {
				return false;
			}
			return ! $this->is_transparent_color( $bg );
		}

		/**
		 * Stronger heuristic: does this element look like it paints a
		 * white / light non-transparent panel? Used by the Background Audit so
		 * the user can spot the white wrapper instantly.
		 *
		 * @param string $style         Inline style attribute.
		 * @param string $data_settings data-settings attribute.
		 * @param string $class         Class attribute.
		 * @return bool
		 */
		private function looks_white_bg( $style, $data_settings, $class ) {
			$bg = $this->inline_background_color( $style );

			if ( '' !== $bg ) {
				if ( $this->is_transparent_color( $bg ) ) {
					return false;
				}
				// Any explicit, non-transparent inline background-color counts —
				// white is the usual culprit but we surface all of them so the
				// painter is never hidden.
				return true;
			}

			// No inline color: fall back to the Elementor data-settings flag,
			// which means "this container has a background layer of some kind".
			if ( '' !== $data_settings && false !== strpos( $data_settings, 'background_background' ) ) {
				return true;
			}

			return false;
		}

		/**
		 * Extract the value of the FIRST background-color (or shorthand
		 * background) declaration from an inline style string. Returns '' if none.
		 *
		 * @param string $style Inline style attribute.
		 * @return string Lower-cased color token, or ''.
		 */
		private function inline_background_color( $style ) {
			if ( '' === $style ) {
				return '';
			}
			$style = strtolower( $style );

			// background-color: <value>;
			if ( preg_match( '/background-color\s*:\s*([^;]+)/', $style, $m ) ) {
				return trim( $m[1] );
			}
			// background: <value>; — grab a leading color token if present.
			if ( preg_match( '/background\s*:\s*([^;]+)/', $style, $m ) ) {
				$val = trim( $m[1] );
				// Pull out a recognisable colour token from the shorthand.
				if ( preg_match( '/(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|white|none)/', $val, $cm ) ) {
					return trim( $cm[1] );
				}
				return $val;
			}
			return '';
		}

		/**
		 * Is a colour token effectively transparent / no paint?
		 *
		 * @param string $color Lower-cased colour token.
		 * @return bool
		 */
		private function is_transparent_color( $color ) {
			$color = trim( strtolower( $color ) );

			if ( '' === $color || 'transparent' === $color || 'none' === $color || 'inherit' === $color ) {
				return true;
			}
			// rgba(...,0) / hsla(...,0) — fully transparent alpha.
			if ( preg_match( '/(?:rgba|hsla)\([^)]*,\s*0(?:\.0+)?\s*\)/', $color ) ) {
				return true;
			}
			// #rrggbb00 / #rgb0 style fully-transparent hex.
			if ( preg_match( '/^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/', $color ) ) {
				$alpha_hex = ( 5 === strlen( $color ) ) ? substr( $color, 4, 1 ) . substr( $color, 4, 1 ) : substr( $color, 7, 2 );
				if ( '00' === $alpha_hex ) {
					return true;
				}
			}
			return false;
		}

		/* =====================================================================
		 *  RESULT RENDERING
		 * ===================================================================== */

		/**
		 * Render the three result views plus a hidden plain-text dump used by
		 * the "Copy as text" button.
		 *
		 * @param array $result Scan payload from scan_homepage().
		 */
		private function render_results( array $result ) {
			$nodes = $result['nodes'];

			// Meta line.
			?>
			<div class="notice notice-success inline" style="max-width:820px;">
				<p>
					Fetched <code><?php echo esc_html( $result['fetched_url'] ); ?></code>
					(HTTP <?php echo (int) $result['http_code']; ?>) —
					<?php echo count( $nodes ); ?> elements parsed.
					<?php if ( $result['root_found'] ) : ?>
						Scoped to <code>body.<?php echo esc_html( self::ROOT_BODY_CLASS ); ?></code>.
					<?php else : ?>
						<strong>Note:</strong> <code>body.<?php echo esc_html( self::ROOT_BODY_CLASS ); ?></code>
						was not found — falling back to the whole <code>&lt;body&gt;</code>.
					<?php endif; ?>
				</p>
			</div>

			<h2 class="nav-tab-wrapper" style="margin-top:20px;">
				<a href="#hl-li-tree"  class="nav-tab nav-tab-active" data-tab="tree">DOM Tree</a>
				<a href="#hl-li-bg"    class="nav-tab"               data-tab="bg">Background Audit</a>
				<a href="#hl-li-ad"    class="nav-tab"               data-tab="ad">Find Ad</a>
			</h2>

			<div id="hl-li-tree" class="hl-li-panel">
				<?php $this->render_tree( $nodes ); ?>
			</div>

			<div id="hl-li-bg" class="hl-li-panel" style="display:none;">
				<?php $this->render_background_audit( $nodes ); ?>
			</div>

			<div id="hl-li-ad" class="hl-li-panel" style="display:none;">
				<?php $this->render_find_ad( $nodes ); ?>
			</div>

			<?php
			// Hidden plain-text payload for the Copy button.
			?>
			<textarea id="hl-li-plain" readonly style="position:absolute;left:-9999px;top:-9999px;"><?php
				echo esc_textarea( $this->build_plain_text( $result ) );
			?></textarea>
			<?php
		}

		/**
		 * View 1 — the full DOM tree as nested <details> elements.
		 *
		 * @param array $nodes Flat pre-order node list.
		 */
		private function render_tree( array $nodes ) {
			if ( empty( $nodes ) ) {
				echo '<p>No elements found.</p>';
				return;
			}

			echo '<p class="description">Every element inside the scoped root, in document order. Background-bearing elements are flagged.</p>';

			// Render a flat, depth-indented list. Each row is one element. We use
			// a simple indented list (not real nesting) so the markup stays robust
			// even if the source DOM is irregular — depth is shown explicitly.
			echo '<div class="hl-li-tree">';
			foreach ( $nodes as $n ) {
				$indent = str_repeat( '&nbsp;&nbsp;&nbsp;&nbsp;', max( 0, (int) $n['depth'] ) );

				$bg_badge = '';
				if ( $n['is_white_bg'] ) {
					$bg_badge = ' <span class="hl-li-badge hl-li-badge-white">WHITE/BG</span>';
				} elseif ( $n['has_bg'] ) {
					$bg_badge = ' <span class="hl-li-badge hl-li-badge-bg">BG</span>';
				}

				echo '<div class="hl-li-row">';
				echo $indent; // phpcs:ignore — pre-built &nbsp; string.
				echo '<span class="hl-li-tag">&lt;' . esc_html( $n['tag'] ) . '&gt;</span>';

				if ( '' !== $n['id'] ) {
					echo ' <span class="hl-li-id">#' . esc_html( $n['id'] ) . '</span>';
				}
				if ( '' !== $n['data_id'] ) {
					echo ' <span class="hl-li-dataid">data-id=' . esc_html( $n['data_id'] ) . '</span>';
				}
				if ( '' !== $n['widget_type'] ) {
					echo ' <span class="hl-li-widget">' . esc_html( $n['widget_type'] ) . '</span>';
				}
				echo $bg_badge; // phpcs:ignore — fixed internal markup.
				echo '<span class="hl-li-depth">d' . (int) $n['depth'] . '</span>';

				if ( '' !== $n['class'] ) {
					echo '<div class="hl-li-class">' . esc_html( $n['class'] ) . '</div>';
				}
				if ( '' !== $n['style'] ) {
					echo '<div class="hl-li-style">style: ' . esc_html( $n['style'] ) . '</div>';
				}
				echo '</div>';
			}
			echo '</div>';
		}

		/**
		 * View 2 — Background Audit. Only white / non-transparent painters.
		 *
		 * @param array $nodes Flat node list.
		 */
		private function render_background_audit( array $nodes ) {
			$hits = array_filter(
				$nodes,
				static function ( $n ) {
					return ! empty( $n['is_white_bg'] ) || ! empty( $n['has_bg'] );
				}
			);

			echo '<p class="description">Elements that appear to paint a white / non-transparent background. The first one that wraps your content area is almost certainly the white panel you are fighting.</p>';

			if ( empty( $hits ) ) {
				echo '<p>No background-bearing elements detected.</p>';
				return;
			}

			echo '<table class="widefat striped hl-li-table"><thead><tr>';
			echo '<th>#</th><th>Flag</th><th>Tag</th><th>data-id</th><th>id</th><th>Classes</th><th>Inline style</th><th>Depth</th>';
			echo '</tr></thead><tbody>';

			$i = 0;
			foreach ( $hits as $n ) {
				$i++;
				$flag = ! empty( $n['is_white_bg'] ) ? 'WHITE/BG' : 'BG';
				echo '<tr>';
				echo '<td>' . (int) $i . '</td>';
				echo '<td><span class="hl-li-badge ' . ( 'WHITE/BG' === $flag ? 'hl-li-badge-white' : 'hl-li-badge-bg' ) . '">' . esc_html( $flag ) . '</span></td>';
				echo '<td><code>' . esc_html( $n['tag'] ) . '</code></td>';
				echo '<td>' . ( '' !== $n['data_id'] ? '<code>' . esc_html( $n['data_id'] ) . '</code>' : '—' ) . '</td>';
				echo '<td>' . ( '' !== $n['id'] ? '<code>' . esc_html( $n['id'] ) . '</code>' : '—' ) . '</td>';
				echo '<td class="hl-li-classcell">' . ( '' !== $n['class'] ? esc_html( $n['class'] ) : '—' ) . '</td>';
				echo '<td class="hl-li-classcell">' . ( '' !== $n['style'] ? esc_html( $n['style'] ) : '—' ) . '</td>';
				echo '<td>' . (int) $n['depth'] . '</td>';
				echo '</tr>';
			}
			echo '</tbody></table>';
		}

		/**
		 * View 3 — Find Ad. Locate ad-ish elements and print each one's full
		 * parent chain up to <body>.
		 *
		 * NOTE: Because our $nodes list is a flat pre-order walk with explicit
		 * depths, we can reconstruct each element's ancestor chain: walking
		 * backwards from the element, the nearest preceding node whose depth is
		 * exactly one less is its parent, and so on up to depth 0.
		 *
		 * @param array $nodes Flat node list.
		 */
		private function render_find_ad( array $nodes ) {

			// Selectors that identify the ad, by class substring.
			$ad_class_markers = array(
				'elementor-widget-shortcode',
				'harne-highlight-wrapper',
				'harne-target',
			);

			$matches = array();
			foreach ( $nodes as $index => $n ) {
				$classes = $this->split_classes( $n['class'] );
				foreach ( $ad_class_markers as $marker ) {
					if ( in_array( $marker, $classes, true ) ) {
						$matches[ $index ] = $marker; // index => which marker matched.
						break;
					}
				}
			}

			echo '<p class="description">Ad candidates matched by class (<code>.elementor-widget-shortcode</code>, <code>.harne-highlight-wrapper</code>, <code>.harne-target</code>) with their full ancestor chain up to <code>&lt;body&gt;</code>.</p>';

			if ( empty( $matches ) ) {
				echo '<p>No ad-like elements (.elementor-widget-shortcode / .harne-highlight-wrapper / .harne-target) were found in the parsed DOM.</p>';
				return;
			}

			$count = 0;
			foreach ( $matches as $index => $marker ) {
				$count++;
				$chain = $this->ancestor_chain( $nodes, $index );

				echo '<div class="hl-li-adblock">';
				echo '<h3>Ad candidate #' . (int) $count . ' &mdash; matched <code>.' . esc_html( $marker ) . '</code></h3>';
				echo '<ol class="hl-li-chain">';
				// $chain is ordered body -> ... -> ad (top to the element).
				foreach ( $chain as $node ) {
					echo '<li>';
					echo '<span class="hl-li-tag">&lt;' . esc_html( $node['tag'] ) . '&gt;</span>';
					if ( '' !== $node['id'] ) {
						echo ' <span class="hl-li-id">#' . esc_html( $node['id'] ) . '</span>';
					}
					if ( '' !== $node['data_id'] ) {
						echo ' <span class="hl-li-dataid">data-id=' . esc_html( $node['data_id'] ) . '</span>';
					}
					if ( '' !== $node['class'] ) {
						echo ' <span class="hl-li-class-inline">' . esc_html( $node['class'] ) . '</span>';
					}
					echo '</li>';
				}
				echo '</ol>';
				echo '</div>';
			}
		}

		/**
		 * Reconstruct the ancestor chain for the node at $index in the flat
		 * pre-order list. Returns an array ordered from the outermost ancestor
		 * (depth 0) down to the node itself.
		 *
		 * @param array $nodes Flat pre-order node list (with 'depth').
		 * @param int   $index Index of the target node.
		 * @return array List of node descriptors, outermost first.
		 */
		private function ancestor_chain( array $nodes, $index ) {
			$chain  = array();
			$target = $nodes[ $index ];
			$chain[] = $target;

			$need_depth = (int) $target['depth'] - 1;

			// Walk backwards: each time we hit a node at the depth we currently
			// need, it's the next parent up.
			for ( $i = $index - 1; $i >= 0 && $need_depth >= 0; $i-- ) {
				if ( (int) $nodes[ $i ]['depth'] === $need_depth ) {
					$chain[]    = $nodes[ $i ];
					$need_depth--;
				}
			}

			// We built it bottom-up; reverse so it reads body -> ... -> ad.
			return array_reverse( $chain );
		}

		/* =====================================================================
		 *  PLAIN-TEXT DUMP (Copy button)
		 * ===================================================================== */

		/**
		 * Build a single plain-text blob of all three views for clipboard copy.
		 *
		 * @param array $result Scan payload.
		 * @return string
		 */
		private function build_plain_text( array $result ) {
			$nodes = $result['nodes'];
			$lines = array();

			$lines[] = 'HL LAYOUT INSPECTOR — scan dump';
			$lines[] = 'Fetched: ' . $result['fetched_url'] . ' (HTTP ' . $result['http_code'] . ')';
			$lines[] = 'Root scope: body.' . self::ROOT_BODY_CLASS . ' (' . ( $result['root_found'] ? 'found' : 'NOT found, used <body>' ) . ')';
			$lines[] = 'Elements: ' . count( $nodes );
			$lines[] = str_repeat( '=', 70 );
			$lines[] = '';

			// --- DOM TREE ---
			$lines[] = '## DOM TREE';
			foreach ( $nodes as $n ) {
				$indent = str_repeat( '  ', max( 0, (int) $n['depth'] ) );
				$parts  = array( '<' . $n['tag'] . '>' );
				if ( '' !== $n['id'] ) {
					$parts[] = '#' . $n['id'];
				}
				if ( '' !== $n['data_id'] ) {
					$parts[] = 'data-id=' . $n['data_id'];
				}
				if ( '' !== $n['widget_type'] ) {
					$parts[] = 'widget=' . $n['widget_type'];
				}
				if ( $n['is_white_bg'] ) {
					$parts[] = '[WHITE/BG]';
				} elseif ( $n['has_bg'] ) {
					$parts[] = '[BG]';
				}
				$parts[] = '(d' . (int) $n['depth'] . ')';
				if ( '' !== $n['class'] ) {
					$parts[] = 'class="' . $n['class'] . '"';
				}
				if ( '' !== $n['style'] ) {
					$parts[] = 'style="' . $n['style'] . '"';
				}
				$lines[] = $indent . implode( ' ', $parts );
			}

			$lines[] = '';
			$lines[] = str_repeat( '=', 70 );
			$lines[] = '';

			// --- BACKGROUND AUDIT ---
			$lines[] = '## BACKGROUND AUDIT (white / non-transparent painters)';
			$bg_i = 0;
			foreach ( $nodes as $n ) {
				if ( empty( $n['is_white_bg'] ) && empty( $n['has_bg'] ) ) {
					continue;
				}
				$bg_i++;
				$flag    = ! empty( $n['is_white_bg'] ) ? 'WHITE/BG' : 'BG';
				$lines[] = sprintf(
					'%d. [%s] <%s> data-id=%s id=%s class="%s" style="%s" (d%d)',
					$bg_i,
					$flag,
					$n['tag'],
					'' !== $n['data_id'] ? $n['data_id'] : '-',
					'' !== $n['id'] ? $n['id'] : '-',
					$n['class'],
					$n['style'],
					(int) $n['depth']
				);
			}
			if ( 0 === $bg_i ) {
				$lines[] = '(none detected)';
			}

			$lines[] = '';
			$lines[] = str_repeat( '=', 70 );
			$lines[] = '';

			// --- FIND AD ---
			$lines[] = '## FIND AD (ad element -> ancestor chain to body)';
			$ad_markers = array( 'elementor-widget-shortcode', 'harne-highlight-wrapper', 'harne-target' );
			$ad_count   = 0;
			foreach ( $nodes as $index => $n ) {
				$classes = $this->split_classes( $n['class'] );
				$matched = '';
				foreach ( $ad_markers as $marker ) {
					if ( in_array( $marker, $classes, true ) ) {
						$matched = $marker;
						break;
					}
				}
				if ( '' === $matched ) {
					continue;
				}
				$ad_count++;
				$lines[] = '';
				$lines[] = 'Ad candidate #' . $ad_count . ' (matched .' . $matched . '):';
				$chain   = $this->ancestor_chain( $nodes, $index );
				$step    = 0;
				foreach ( $chain as $node ) {
					$prefix  = str_repeat( '  ', $step );
					$desc    = '<' . $node['tag'] . '>';
					if ( '' !== $node['id'] ) {
						$desc .= ' #' . $node['id'];
					}
					if ( '' !== $node['data_id'] ) {
						$desc .= ' data-id=' . $node['data_id'];
					}
					if ( '' !== $node['class'] ) {
						$desc .= ' class="' . $node['class'] . '"';
					}
					$lines[] = $prefix . $desc;
					$step++;
				}
			}
			if ( 0 === $ad_count ) {
				$lines[] = '(no ad-like elements found)';
			}

			return implode( "\n", $lines );
		}

		/* =====================================================================
		 *  SMALL HELPERS
		 * ===================================================================== */

		/**
		 * Return an element's class attribute as a trimmed array of tokens.
		 *
		 * @param DOMElement $el Element.
		 * @return string[]
		 */
		private function class_list( DOMElement $el ) {
			return $this->split_classes( $el->getAttribute( 'class' ) );
		}

		/**
		 * Split a class string into a clean token array.
		 *
		 * @param string $class Raw class attribute.
		 * @return string[]
		 */
		private function split_classes( $class ) {
			$class = trim( (string) $class );
			if ( '' === $class ) {
				return array();
			}
			return preg_split( '/\s+/', $class );
		}

		/* =====================================================================
		 *  INLINE ASSETS (kept inline so the plugin stays a single file)
		 * ===================================================================== */

		/**
		 * Print the page's CSS. Inline to keep this a single self-contained file.
		 */
		private function print_styles() {
			?>
			<style>
				.hl-li-panel { margin-top:16px; }
				.hl-li-tree {
					font-family: Menlo, Consolas, Monaco, monospace;
					font-size: 12px;
					line-height: 1.5;
					background:#1e1e1e;
					color:#d4d4d4;
					padding:14px 16px;
					border-radius:6px;
					overflow:auto;
					max-height:70vh;
				}
				.hl-li-row { white-space:nowrap; padding:1px 0; }
				.hl-li-tag    { color:#569cd6; font-weight:600; }
				.hl-li-id     { color:#4ec9b0; }
				.hl-li-dataid { color:#dcdcaa; }
				.hl-li-widget { color:#c586c0; }
				.hl-li-depth  { color:#808080; margin-left:8px; }
				.hl-li-class       { color:#ce9178; white-space:normal; padding-left:24px; }
				.hl-li-class-inline{ color:#ce9178; }
				.hl-li-style  { color:#9cdcfe; white-space:normal; padding-left:24px; }
				.hl-li-badge {
					display:inline-block;
					font-family: -apple-system, sans-serif;
					font-size:10px;
					font-weight:700;
					padding:1px 6px;
					border-radius:3px;
					margin-left:6px;
					vertical-align:middle;
				}
				.hl-li-badge-white { background:#ffffff; color:#b30000; border:1px solid #b30000; }
				.hl-li-badge-bg    { background:#3a3a00; color:#ffe066; }
				.hl-li-table { margin-top:12px; }
				.hl-li-classcell { font-family: Menlo, Consolas, monospace; font-size:11px; max-width:340px; word-break:break-word; }
				.hl-li-adblock {
					background:#fff;
					border:1px solid #c3c4c7;
					border-left:4px solid #2271b1;
					padding:8px 16px;
					margin:14px 0;
					border-radius:4px;
				}
				.hl-li-chain { font-family: Menlo, Consolas, monospace; font-size:12px; }
				.hl-li-chain li { margin:2px 0; }
			</style>
			<?php
		}

		/**
		 * Print the page's JS: tab switching + clipboard copy. No jQuery needed.
		 */
		private function print_script() {
			?>
			<script>
			( function () {
				// --- Tab switching ---
				var tabs   = document.querySelectorAll( '.nav-tab[data-tab]' );
				var panels = {
					tree: document.getElementById( 'hl-li-tree' ),
					bg:   document.getElementById( 'hl-li-bg' ),
					ad:   document.getElementById( 'hl-li-ad' )
				};
				tabs.forEach( function ( tab ) {
					tab.addEventListener( 'click', function ( e ) {
						e.preventDefault();
						tabs.forEach( function ( t ) { t.classList.remove( 'nav-tab-active' ); } );
						tab.classList.add( 'nav-tab-active' );
						Object.keys( panels ).forEach( function ( key ) {
							if ( panels[ key ] ) {
								panels[ key ].style.display = ( key === tab.dataset.tab ) ? '' : 'none';
							}
						} );
					} );
				} );

				// --- Copy as text ---
				var copyBtn = document.getElementById( 'hl-li-copy' );
				if ( copyBtn ) {
					copyBtn.addEventListener( 'click', function () {
						var ta     = document.getElementById( 'hl-li-plain' );
						var status = document.getElementById( 'hl-li-copy-status' );
						if ( ! ta ) { return; }

						var done = function () {
							if ( status ) {
								status.textContent = 'Copied!';
								setTimeout( function () { status.textContent = ''; }, 2500 );
							}
						};

						// Prefer the async Clipboard API; fall back to execCommand.
						if ( navigator.clipboard && navigator.clipboard.writeText ) {
							navigator.clipboard.writeText( ta.value ).then( done, function () {
								legacyCopy( ta, done );
							} );
						} else {
							legacyCopy( ta, done );
						}
					} );
				}

				function legacyCopy( ta, cb ) {
					// Move offscreen textarea on-screen briefly to allow selection.
					var prev = ta.style.cssText;
					ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;';
					ta.focus();
					ta.select();
					try { document.execCommand( 'copy' ); } catch ( e ) {}
					ta.style.cssText = prev;
					cb();
				}
			}() );
			</script>
			<?php
		}
	}

	// Boot the plugin.
	HL_Layout_Inspector::init();
}
