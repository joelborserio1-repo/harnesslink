# frozen_string_literal: true

# A managed advertisement served into a reserved AdSlot zone. "Live" = active
# and within its optional date window.
class Ad < ApplicationRecord
  validates :name, presence: true
  validates :zone, presence: true

  scope :live, lambda {
    now = Time.current
    where(is_active: true)
      .where("starts_at IS NULL OR starts_at <= ?", now)
      .where("ends_at IS NULL OR ends_at >= ?", now)
  }

  # Pick one live ad per zone, weighted by `weight`. Returns { zone => Ad }.
  def self.live_by_zone
    live.order(:zone).group_by(&:zone).transform_values { |ads| weighted_pick(ads) }
  end

  # Weighted random choice. Deterministic-ish caching happens upstream (the API
  # response is revalidated), so a fresh pick per request window is fine.
  def self.weighted_pick(ads)
    total = ads.sum { |a| [a.weight, 1].max }
    target = rand(total)
    cursor = 0
    ads.each do |a|
      cursor += [a.weight, 1].max
      return a if target < cursor
    end
    ads.first
  end

  def has_creative?
    image_url.present? || html.present?
  end
end
