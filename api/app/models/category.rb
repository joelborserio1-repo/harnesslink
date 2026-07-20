# frozen_string_literal: true

class Category < ApplicationRecord
  # geographic: USA, New Zealand, Australia, Canada, Europe, UK/IRE, International
  # editorial:  Top 4, Blog, Articles, …
  enum :kind, { geographic: 0, editorial: 1 }, prefix: true

  belongs_to :parent, class_name: "Category", optional: true
  has_many :children, class_name: "Category", foreign_key: :parent_id,
                      inverse_of: :parent, dependent: :nullify

  has_many :article_categories, dependent: :destroy
  has_many :articles, through: :article_categories
  has_one  :country, dependent: :nullify

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { without: %r{[\s/]}, message: "must be a single URL path segment" }
  validates :legacy_term_id, uniqueness: true, allow_nil: true

  scope :ordered, -> { order(:position, :name) }
end
