# frozen_string_literal: true

class CreatePeople < ActiveRecord::Migration[8.1]
  def change
    # Admin / editorial login accounts. Distinct from Author (a byline).
    create_table :users do |t|
      t.string  :email, null: false
      t.string  :name
      t.integer :role, null: false, default: 0 # contributor / editor / admin
      t.string  :password_digest
      t.bigint  :legacy_wp_user_id
      t.timestamps
    end
    add_index :users, :email, unique: true

    # Bylined contributors (Adam Hamilton, Tony Milanese, …).
    # legacy_refs captures provenance across the site's overlapping author
    # systems (WP user, Molongui, PublishPress, guest_author post, author tag)
    # so we can reconcile without a schema change once the canonical source is
    # chosen. merged_into_id collapses duplicates (e.g. two "Bruce Stewart"s).
    create_table :authors do |t|
      t.string  :name, null: false
      t.string  :slug, null: false
      t.text    :bio
      t.string  :email
      t.string  :avatar_url
      t.string  :twitter
      t.string  :role_title
      t.integer :position, null: false, default: 0
      t.jsonb   :legacy_refs, null: false, default: {}
      t.references :merged_into, foreign_key: { to_table: :authors }
      t.timestamps
    end
    add_index :authors, :slug, unique: true
    add_index :authors, :legacy_refs, using: :gin
  end
end
