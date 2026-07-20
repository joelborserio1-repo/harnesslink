# frozen_string_literal: true

# The HarnessLink Directory — a monetised multi-category listings feature
# (stallions, trainers, drivers, agistment, transport, vets, …), rebuilt from
# the WordPress `hld_*` tables. Additive + reversible.
class CreateDirectory < ActiveRecord::Migration[8.1]
  def change
    create_table :directory_listings do |t|
      t.string  :directory_type, null: false, default: "stallion"
      t.string  :name,           null: false
      t.string  :slug,           null: false
      t.string  :stud_name,      null: false, default: ""
      t.string  :country,        null: false, default: ""
      t.string  :region,         null: false, default: ""
      t.string  :stud_master,    null: false, default: ""
      t.string  :suburb,         null: false, default: ""
      t.string  :industry,       null: false, default: ""
      t.text    :coverage
      t.string  :gait,           null: false, default: "Pacer" # Pacer | Trotter
      t.string  :status_note,    null: false, default: ""
      t.boolean :is_paying,      null: false, default: false
      t.boolean :is_featured,    null: false, default: false
      t.string  :contact_phone,   null: false, default: ""
      t.string  :contact_email,   null: false, default: ""
      t.string  :contact_website, null: false, default: ""
      t.string  :stud_website,    null: false, default: ""
      t.text    :contact_address
      t.text    :profile_bio
      t.string  :profile_image,  null: false, default: ""
      t.string  :race_record,    null: false, default: ""
      t.string  :service_fee,    null: false, default: ""
      t.text    :progeny_note
      t.bigint  :legacy_id # original wzev_hld_stallions.id — preserves /directory/{type}/{id}/{slug}
      t.timestamps
    end
    add_index :directory_listings, :slug
    add_index :directory_listings, :legacy_id, unique: true
    add_index :directory_listings, [:directory_type, :is_featured]
    add_index :directory_listings, :country

    create_table :directory_progeny do |t|
      t.references :directory_listing, null: false, foreign_key: true
      t.string  :name,           null: false, default: ""
      t.string  :foaling_date,   null: false, default: ""
      t.string  :country,        null: false, default: ""
      t.string  :sex,            null: false, default: ""
      t.string  :dam,            null: false, default: ""
      t.string  :broodmare_sire, null: false, default: ""
      t.string  :prizemoney,     null: false, default: ""
      t.bigint  :prizemoney_num, null: false, default: 0
      t.string  :mile_rate,      null: false, default: ""
      t.integer :starts,         null: false, default: 0
      t.integer :wins,           null: false, default: 0
      t.integer :sort_order,     null: false, default: 0
    end
    add_index :directory_progeny, [:directory_listing_id, :prizemoney_num]

    create_table :directory_enquiries do |t|
      t.references :directory_listing, foreign_key: true # may be a general enquiry
      t.string  :listing_type, null: false, default: ""
      t.string  :name,         null: false, default: ""
      t.string  :email,        null: false, default: ""
      t.string  :phone,        null: false, default: ""
      t.text    :message
      t.string  :status,       null: false, default: "new"
      t.timestamps
    end
    add_index :directory_enquiries, :status
  end
end
