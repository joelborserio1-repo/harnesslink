# frozen_string_literal: true

class Author < ApplicationRecord
  belongs_to :merged_into, class_name: "Author", optional: true
  has_many :aliases, class_name: "Author", foreign_key: :merged_into_id,
                     inverse_of: :merged_into, dependent: :nullify

  has_many :article_authors, dependent: :destroy
  has_many :articles, through: :article_authors

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { without: %r{[\s/]}, message: "must be a single URL path segment" }

  # Authors that are their own canonical record (not merged into another).
  scope :canonical, -> { where(merged_into_id: nil) }

  def canonical
    merged_into || self
  end
end
