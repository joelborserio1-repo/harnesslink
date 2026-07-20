# frozen_string_literal: true

# Imported articles whose body needs a human look (e.g. WPBakery/Elementor
# shortcodes that don't render as plain HTML, or an empty body) are flagged
# rather than published silently.
class AddNeedsReviewToArticles < ActiveRecord::Migration[8.1]
  def change
    add_column :articles, :needs_review, :boolean, null: false, default: false
    add_column :articles, :import_flags, :jsonb, null: false, default: []
    add_index :articles, :needs_review
  end
end
