# frozen_string_literal: true

class Article < ApplicationRecord
  # Legacy WordPress articles keep their rendered HTML verbatim; new articles
  # author structured TipTap JSON. The renderer branches on this.
  enum :body_format, { legacy_html: 0, tiptap_json: 1 }, prefix: true

  enum :status, {
    draft: 0, in_review: 1, scheduled: 2, published: 3, archived: 4
  }, prefix: true

  belongs_to :primary_category, class_name: "Category", optional: true
  belongs_to :featured_media, class_name: "MediaAsset", optional: true
  belongs_to :og_image, class_name: "MediaAsset", optional: true
  belongs_to :twitter_image, class_name: "MediaAsset", optional: true

  has_many :article_categories, dependent: :destroy
  has_many :categories, through: :article_categories

  has_many :article_tags, dependent: :destroy
  has_many :tags, through: :article_tags

  has_many :article_authors, -> { order(:position) }, dependent: :destroy
  has_many :authors, through: :article_authors

  has_many :article_revisions, dependent: :destroy

  validates :title, presence: true
  validates :slug, presence: true, uniqueness: true,
                   format: { without: %r{[\s/]}, message: "must be a single URL path segment" }
  validates :legacy_wp_id, uniqueness: true, allow_nil: true
  validates :legacy_url, uniqueness: true, allow_nil: true
  validate  :body_present_for_format

  scope :live, -> { status_published.where(published_at: ..Time.current) }
  scope :recent_first, -> { order(published_at: :desc) }

  # The primary byline is the lowest-position author.
  def primary_author
    authors.merge(ArticleAuthor.order(:position)).first
  end

  private

  def body_present_for_format
    if body_format_legacy_html? && body_html.blank?
      errors.add(:body_html, "can't be blank for a legacy_html article")
    elsif body_format_tiptap_json? && (body_json.blank? || body_json == {})
      errors.add(:body_json, "can't be blank for a tiptap_json article")
    end
  end
end
