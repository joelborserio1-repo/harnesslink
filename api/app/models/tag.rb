# frozen_string_literal: true

class Tag < ApplicationRecord
  has_many :article_tags, dependent: :destroy
  has_many :articles, through: :article_tags

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { without: %r{[\s/]}, message: "must be a single URL path segment" }
  validates :legacy_term_id, uniqueness: true, allow_nil: true
end
