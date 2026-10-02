# frozen_string_literal: true

# A static page migrated from WordPress. Body HTML is preserved verbatim
# (sanitised), exactly like a legacy article. Pages that are really features —
# the directory, race calendars, The Eureka, login — are rebuilt natively in the
# front end and are NOT stored here.
class Page < ApplicationRecord
  enum :status, { draft: 0, published: 3, archived: 4 }, prefix: true

  validates :title, presence: true
  validates :path, presence: true, uniqueness: true,
                   format: { with: %r{\A[a-z0-9][a-z0-9\-_]*(/[a-z0-9][a-z0-9\-_]*)*\z},
                             message: "must be a URL path without leading or trailing slashes" }
  validates :legacy_wp_id, uniqueness: true, allow_nil: true

  scope :live, -> { status_published }

  def url
    "/#{path}/"
  end
end
