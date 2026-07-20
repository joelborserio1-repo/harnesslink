# frozen_string_literal: true

class CreateRedirects < ActiveRecord::Migration[8.1]
  def change
    create_table :redirects do |t|
      t.string   :from_path, null: false
      t.string   :to_path, null: false
      t.integer  :status_code, null: false, default: 301
      t.bigint   :hit_count, null: false, default: 0
      t.datetime :last_hit_at
      # wp_old_slug (39k of them) / slug_change / manual / imported
      t.string   :reason
      t.timestamps
    end
    add_index :redirects, :from_path, unique: true
  end
end
