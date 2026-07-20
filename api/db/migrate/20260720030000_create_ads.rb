# frozen_string_literal: true

# Ad management — creative served into the reserved AdSlot zones. Replaces the
# placeholder boxes with managed, date-windowed, weighted ads + click tracking.
class CreateAds < ActiveRecord::Migration[8.1]
  def change
    create_table :ads do |t|
      t.string   :name,       null: false
      t.string   :zone,       null: false           # placement key, e.g. "home-top"
      t.string   :size,       null: false, default: "mpu"
      t.string   :image_url,  null: false, default: ""
      t.string   :link_url,   null: false, default: ""
      t.string   :alt,        null: false, default: ""
      t.text     :html                              # optional raw HTML creative (admin-trusted)
      t.boolean  :is_active,  null: false, default: true
      t.datetime :starts_at
      t.datetime :ends_at
      t.integer  :weight,     null: false, default: 1
      t.bigint   :impressions, null: false, default: 0
      t.bigint   :clicks,      null: false, default: 0
      t.timestamps
    end
    add_index :ads, [:zone, :is_active]
  end
end
