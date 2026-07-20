# frozen_string_literal: true

class MediaAsset < ApplicationRecord
  # ~40k legacy attachment rows point at files that are not on disk; we track
  # that rather than silently reproducing broken images.
  enum :status, { active: 0, missing: 1 }, prefix: true

  validates :legacy_wp_id, uniqueness: true, allow_nil: true

  DEFAULT_WIDTHS = [320, 640, 960, 1280].freeze
  DEFAULT_SIZES = "(max-width: 768px) 100vw, 800px"

  def dimensions_known?
    width.present? && height.present?
  end

  # Where imgproxy fetches the original: the migrated key if we have one, else
  # the original WordPress URL (valid during the transition).
  def source_url
    storage_key.presence || legacy_url
  end

  # A responsive image payload for the front end. width/height are the intrinsic
  # dimensions so the browser can reserve space (CLS).
  def responsive(widths: DEFAULT_WIDTHS, format: "webp", sizes: DEFAULT_SIZES)
    src = source_url
    return nil if src.blank?

    {
      src: Media::Imgproxy.url(src, width: widths.max, format: format),
      srcset: widths.map { |w| "#{Media::Imgproxy.url(src, width: w, format: format)} #{w}w" }.join(", "),
      sizes: sizes,
      width: width,
      height: height,
      alt: alt.to_s
    }
  end
end
