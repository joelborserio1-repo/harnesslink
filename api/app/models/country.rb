# frozen_string_literal: true

# The "Explore by Countries" nav — a curated, ordered list that points at the
# geographic categories. Archive URLs remain category archives.
class Country < ApplicationRecord
  belongs_to :category, optional: true

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { without: %r{[\s/]}, message: "must be a single URL path segment" }

  scope :ordered, -> { order(:position, :name) }
end
