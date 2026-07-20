# frozen_string_literal: true

class User < ApplicationRecord
  # NOTE: password auth (has_secure_password) needs the bcrypt gem. That's a
  # dependency add, so it is intentionally deferred until approved — the
  # password_digest column is already in place for when it lands.
  enum :role, { contributor: 0, editor: 1, admin: 2 }, prefix: :role

  has_many :article_revisions, foreign_key: :editor_id,
                               inverse_of: :editor, dependent: :nullify

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
end
