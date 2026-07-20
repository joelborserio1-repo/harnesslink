# frozen_string_literal: true

class MediaAsset < ApplicationRecord
  # ~40k legacy attachment rows point at files that are not on disk; we track
  # that rather than silently reproducing broken images.
  enum :status, { active: 0, missing: 1 }, prefix: true

  validates :legacy_wp_id, uniqueness: true, allow_nil: true

  def dimensions_known?
    width.present? && height.present?
  end
end
