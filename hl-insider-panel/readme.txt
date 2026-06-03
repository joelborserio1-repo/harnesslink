=== HarnessLink Insider Panel ===
Contributors: harnesslink
Tags: block, shortcode, newsletter, subscribe, widget
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

"The Insider" subscribe panel as an editable Gutenberg block and a [insider_panel] shortcode. Dependency-free, team-friendly, no build step.

== Description ==

HarnessLink Insider Panel adds a polished "The Insider" subscribe card to your
site. It registers TWO ways to place the identical panel, both powered by ONE
shared PHP render function so output is always the same:

1. A Gutenberg block named **Insider Panel** (category: Widgets) with all fields
   editable in the block sidebar, plus a live preview.
2. A shortcode **[insider_panel]** for use in the Elementor "Shortcode" widget,
   the Classic editor, or anywhere shortcodes run.

Features:

* No dependencies — no ACF, no Composer, no npm/webpack build.
* Bundled, namespaced CSS (everything lives under `.hl-insider`).
* Multiple independent instances per page (per-instance colours & gutter are
  injected as inline CSS custom properties; the stylesheet stays static).
* Editable eyebrow, headline (with line break), subhead, badge, CTA, "this week"
  list (with selectable icons), schedule and social-proof line.
* Optional colour controls and layout options (left gutter, fixed height).
* All output escaped; translation-ready (text domain `hl-insider`).

== Installation ==

1. Zip the `hl-insider-panel` folder (see "How to zip" below) so the archive
   contains a top-level `hl-insider-panel/` directory with `hl-insider-panel.php`
   inside it.
2. In WordPress go to **Plugins → Add New → Upload Plugin**, choose the zip and
   click **Install Now**, then **Activate**.
3. Add the block ("Insider Panel") in the editor, or drop the shortcode
   `[insider_panel]` into any content area.

= How to zip =

From the directory that CONTAINS `hl-insider-panel/`:

    zip -r hl-insider-panel.zip hl-insider-panel \
      -x "*.DS_Store" -x "*/.git/*"

That produces `hl-insider-panel.zip`, ready for **Upload Plugin**.

== Usage: the block ==

Insert the **Insider Panel** block (Widgets category). Edit fields in the right
sidebar:

* **Content** — eyebrow, headline (press Enter for a line break), subhead.
* **Badge** — show/hide, top and bottom text.
* **Call to action** — button text, URL, open in new tab.
* **This week items** — add / remove / reorder rows (up to 8); each row has a
  text field and an icon dropdown.
* **Footer** — schedule line (show/hide + text) and proof line (show/hide + text).
* **Layout** — left gutter (px) and fixed desktop height.
* **Colors** — navy, accent, gold, ink, muted, lines.

The preview is rendered by the real PHP output (via ServerSideRender), so what
you see matches the front end.

== Usage: the shortcode ==

Basic (uses all defaults, including the four default items):

    [insider_panel]

Override scalar fields:

    [insider_panel
      eyebrow="THE INSIDER"
      headline="Exclusive insights.|Every Thursday."
      cta_text="Subscribe Now"
      cta_url="https://harnesslink.com/the-insider/editions/"
      cta_new_tab="true"
      schedule_text="Every Thursday 3PM"]

Notes:
* In `headline`, use `|` (or a literal `\n`) for the line break.
* Booleans accept `true`/`false` (also `1`/`0`, `yes`/`no`).

Custom "this week" items with icons — use `item_1`..`item_8` and the matching
`icon_1`..`icon_8`. If you supply any items, the defaults are replaced:

    [insider_panel
      item_1="Why one stable is changing drivers"   icon_1="lines"
      item_2="Sales trends reshaping breeding"        icon_2="trend"
      item_3="The US racing controversy"             icon_3="alert"
      item_4="3 horses flying under the radar"        icon_4="eye"]

Available icon keys: `lines`, `trend`, `alert`, `eye`, `star`, `flag`,
`calendar`, `dollar`. An unknown key falls back to `lines`.

Colour override (any subset of the six):

    [insider_panel
      color_navy="#0e2455"
      color_accent="#244287"
      color_gold="#c9a24b"
      color_ink="#16213f"
      color_muted="#5b6478"
      color_line="#e4e6ec"]

Left gutter and fixed height:

    [insider_panel pad_left="40" fixed_height="false"]

== Bolding the proof line ==

The proof line supports simple bold. Either:

* Wrap text in double asterisks: `proof_text="Join **7,000+** readers"`, or
* Leave it plain (e.g. `Join 7,000+ readers every Thursday.`) and the FIRST
  number — including thousands separators and a trailing `+`, like `7,000+` —
  is bolded automatically.

Only `<b>`/`<strong>` are allowed in this field; everything else is escaped.

== Disabling Google Fonts ==

The panel uses Playfair Display + Source Sans 3, loaded via `wp_enqueue_style`.
If your theme already loads these, disable the plugin's font request either way:

* Add a filter (in your theme's functions.php or a small mu-plugin):

      add_filter( 'hl_insider_load_fonts', '__return_false' );

* Or define a constant in `wp-config.php`:

      define( 'HL_INSIDER_DISABLE_FONTS', true );

== Frequently Asked Questions ==

= Can I place more than one panel on a page? =
Yes. Each instance is independent — colours and the left gutter are applied
inline per instance, so they never collide.

= Does it work inside Elementor? =
Yes. Add an Elementor "Shortcode" widget and paste `[insider_panel ...]`.

== Changelog ==

= 1.0.0 =
* Initial release: Insider Panel block + [insider_panel] shortcode, shared
  render function, bundled CSS, icon set, colour and layout controls.
