# frozen_string_literal: true

class User < ApplicationRecord
  # `reader` is the free registration-wall tier (migrated WordPress
  # subscribers); the others are editorial. Reader auth is passwordless
  # (magic-link) — imported readers carry no password_digest.
  enum :role, { contributor: 0, editor: 1, admin: 2, reader: 3 }, prefix: :role

  has_many :article_revisions, foreign_key: :editor_id,
                               inverse_of: :editor, dependent: :nullify

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :legacy_wp_user_id, uniqueness: true, allow_nil: true
end
