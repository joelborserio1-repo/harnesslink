# frozen_string_literal: true

# Per-person staff logins for the editorial portal (replaces the shared
# ADMIN_USER / ADMIN_PASSWORD gate).
#   users.active        — deactivate a login without deleting its history
#   users.author_id     — the byline a journalist files under
#   articles.created_by — who filed the story; scopes a contributor to their own
class AddStaffAccountsAndArticleOwnership < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :active, :boolean, default: true, null: false
    add_column :users, :last_sign_in_at, :datetime
    add_reference :users, :author, foreign_key: true, null: true
    add_reference :articles, :created_by, foreign_key: { to_table: :users }, null: true
  end
end
