# frozen_string_literal: true

class CreateArticleRevisions < ActiveRecord::Migration[8.1]
  def change
    create_table :article_revisions do |t|
      t.references :article, null: false, foreign_key: true
      t.references :editor, foreign_key: { to_table: :users }
      t.string  :title
      t.string  :subtitle
      t.integer :body_format, null: false, default: 0
      t.text    :body_html
      t.jsonb   :body_json, null: false, default: {}
      t.timestamps
    end
  end
end
