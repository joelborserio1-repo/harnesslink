# frozen_string_literal: true

class CreateTaxonomy < ActiveRecord::Migration[8.1]
  def change
    create_table :categories do |t|
      t.string  :name, null: false
      t.string  :slug, null: false
      t.references :parent, foreign_key: { to_table: :categories }
      # kind: geographic (USA, NZ, Australia…) vs editorial (Top 4, Blog…)
      t.integer :kind, null: false, default: 0
      t.integer :position, null: false, default: 0
      t.text    :description
      t.bigint  :legacy_term_id
      t.integer :posts_count, null: false, default: 0
      t.timestamps
    end
    add_index :categories, :slug, unique: true
    add_index :categories, :legacy_term_id, unique: true

    create_table :tags do |t|
      t.string  :name, null: false
      t.string  :slug, null: false
      t.bigint  :legacy_term_id
      t.integer :posts_count, null: false, default: 0
      t.timestamps
    end
    add_index :tags, :slug, unique: true
    add_index :tags, :legacy_term_id, unique: true

    # "Explore by Countries" nav — a curated, ordered subset that points at the
    # geographic categories (so archive URLs stay category archives).
    create_table :countries do |t|
      t.string     :name, null: false
      t.string     :slug, null: false
      t.references :category, foreign_key: true
      t.integer    :position, null: false, default: 0
      t.timestamps
    end
    add_index :countries, :slug, unique: true
  end
end
