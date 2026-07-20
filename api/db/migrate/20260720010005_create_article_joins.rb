# frozen_string_literal: true

class CreateArticleJoins < ActiveRecord::Migration[8.1]
  def change
    create_table :article_categories do |t|
      t.references :article, null: false, foreign_key: true
      t.references :category, null: false, foreign_key: true
      t.timestamps
    end
    add_index :article_categories, [:article_id, :category_id], unique: true

    create_table :article_tags do |t|
      t.references :article, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true
      t.timestamps
    end
    add_index :article_tags, [:article_id, :tag_id], unique: true

    # Articles can carry co-bylines (Molongui/PublishPress both support this).
    # position orders the byline; the first is the primary author.
    create_table :article_authors do |t|
      t.references :article, null: false, foreign_key: true
      t.references :author, null: false, foreign_key: true
      t.integer    :position, null: false, default: 0
      t.timestamps
    end
    add_index :article_authors, [:article_id, :author_id], unique: true
  end
end
