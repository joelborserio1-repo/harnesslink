# frozen_string_literal: true

class User < ApplicationRecord
  # `reader` is the free registration-wall tier (migrated WordPress
  # subscribers); the others are editorial staff who sign in to the portal.
  # Reader auth is passwordless (magic-link) — imported readers carry no
  # password_digest, so password validation is opt-in for staff only.
  enum :role, { contributor: 0, editor: 1, admin: 2, reader: 3 }, prefix: :role

  has_secure_password validations: false

  # The byline this person files under (journalists; optional for desk staff).
  belongs_to :author, optional: true

  has_many :articles, foreign_key: :created_by_id, inverse_of: :created_by, dependent: :nullify
  has_many :article_revisions, foreign_key: :editor_id,
                               inverse_of: :editor, dependent: :nullify

  normalizes :email, with: ->(e) { e.strip.downcase }

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :legacy_wp_user_id, uniqueness: true, allow_nil: true
  validates :password, length: { minimum: 10 }, allow_nil: true
  # No presence check on the digest: staff imported from WordPress arrive
  # without a usable password and cannot sign in until an admin sets one.

  scope :staff, -> { where.not(role: :reader) }

  # Stateless portal session token. Tied to the password salt, so changing the
  # password signs every device out.
  generates_token_for :staff_session, expires_in: 14.days do
    password_salt&.last(10)
  end

  def staff?
    !role_reader?
  end

  # Editors and admins may publish, schedule and edit anyone's story.
  def can_publish?
    role_editor? || role_admin?
  end
end
