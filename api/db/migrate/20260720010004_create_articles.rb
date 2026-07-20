# frozen_string_literal: true

class CreateArticles < ActiveRecord::Migration[8.1]
  def change
    create_table :articles do |t|
      t.string  :title, null: false
      t.string  :subtitle                 # WP post_subtitle (present on ~51k posts)
      t.string  :slug, null: false        # flat /%postname%/ — the whole path
      t.text    :excerpt

      # The core architecture decision: legacy articles keep WP-rendered HTML
      # verbatim; new articles author TipTap JSON. The renderer branches on this.
      t.integer :body_format, null: false, default: 0 # legacy_html / tiptap_json
      t.text    :body_html
      t.jsonb   :body_json, null: false, default: {}

      t.integer :status, null: false, default: 0 # draft/in_review/scheduled/published/archived
      t.datetime :published_at
      t.datetime :scheduled_for
      t.datetime :legacy_modified_at       # WP post_modified — preserved for dateModified

      t.references :primary_category, foreign_key: { to_table: :categories }
      t.references :featured_media, foreign_key: { to_table: :media_assets }
      t.string  :featured_image_caption
      t.string  :featured_image_credit
      t.string  :byline_text               # free-text secondary byline, e.g. "for HRNZ"

      t.integer :reading_time_minutes
      t.bigint  :view_count, null: false, default: 0

      # SEO — mirrors Rank Math's per-post fields (brief #3). When blank, the
      # renderer falls back to the site-wide Rank Math title/description formats.
      t.string  :seo_title
      t.text    :seo_description
      t.string  :focus_keyword
      t.string  :canonical_url
      t.string  :robots                    # e.g. "index,follow"
      t.string  :og_title
      t.text    :og_description
      t.references :og_image, foreign_key: { to_table: :media_assets }
      t.string  :twitter_title
      t.text    :twitter_description
      t.references :twitter_image, foreign_key: { to_table: :media_assets }
      t.string  :schema_type, null: false, default: "NewsArticle"

      # Provenance — never null for migrated content, our proof of completeness.
      t.bigint  :legacy_wp_id
      t.string  :legacy_url                # full original path
      t.string  :legacy_source             # e.g. "wordpress"

      t.timestamps
    end

    add_index :articles, :slug, unique: true
    add_index :articles, :legacy_wp_id, unique: true
    add_index :articles, :legacy_url, unique: true
    # We have 60k+ published rows; these back the hot read paths.
    add_index :articles, :published_at, order: { published_at: :desc }
    add_index :articles, [:primary_category_id, :published_at]
    add_index :articles, :status
  end
end
