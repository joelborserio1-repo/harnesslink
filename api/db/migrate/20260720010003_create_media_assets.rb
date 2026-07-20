# frozen_string_literal: true

class CreateMediaAssets < ActiveRecord::Migration[8.1]
  def change
    create_table :media_assets do |t|
      t.bigint  :legacy_wp_id
      t.string  :legacy_url          # original WordPress URL, for in-body rewriting
      t.string  :storage_key         # new object-store key / path
      t.string  :mime_type
      t.integer :width
      t.integer :height
      t.bigint  :byte_size
      t.string  :title
      t.string  :alt
      t.text    :caption
      t.string  :credit
      t.string  :blurhash
      # active / missing — ~40k legacy attachment rows point at files not on disk
      t.integer :status, null: false, default: 0
      t.timestamps
    end
    add_index :media_assets, :legacy_wp_id, unique: true
    add_index :media_assets, :legacy_url
  end
end
