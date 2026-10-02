# frozen_string_literal: true

# Static WordPress pages (privacy policy, terms, advertise with us …) carried
# over verbatim, the same way legacy articles are. `path` is the full URL path
# without slashes at either end, so a child page is "the-insider/editions".
class CreatePages < ActiveRecord::Migration[8.1]
  def change
    create_table :pages do |t|
      t.string :path, null: false
      t.string :title, null: false
      t.text :body_html
      t.integer :status, null: false, default: 3 # mirrors Article: 3 = published
      t.string :seo_title
      t.text :seo_description
      t.string :canonical_url
      t.string :robots
      t.bigint :legacy_wp_id
      t.string :legacy_url
      t.datetime :published_at
      t.datetime :legacy_modified_at
      t.timestamps
    end
    add_index :pages, :path, unique: true
    add_index :pages, :legacy_wp_id, unique: true
  end
end
