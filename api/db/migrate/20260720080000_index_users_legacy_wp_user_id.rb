# frozen_string_literal: true

# Provenance uniqueness for the WordPress user import (nulls allowed for
# natively-created accounts).
class IndexUsersLegacyWpUserId < ActiveRecord::Migration[8.1]
  def change
    add_index :users, :legacy_wp_user_id, unique: true
  end
end
