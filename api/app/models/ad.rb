# frozen_string_literal: true

# A managed advertisement served into a reserved AdSlot zone. "Live" = active
# and within its optional date window.
class Ad < ApplicationRecord
  validates :name, presence: true
  validates :zone, presence: true, inclusion: { in: ->(_) { Ads::Zones.keys }, message: "is not a known placement" }
  validates :image_width, :image_height, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true

  scope :live, lambda {
    now = Time.current
    where(is_active: true)
      .where("starts_at IS NULL OR starts_at <= ?", now)
      .where("ends_at IS NULL OR ends_at >= ?", now)
  }

  # The ads to show right now, per zone: { zone => [Ad, …] }. Single-slot
  # zones get one weighted pick; rails get up to their slot count, all
  # different (weighted draw without replacement).
  def self.live_by_zone
    live.order(:zone, :id).group_by(&:zone).to_h do |zone, ads|
      [ zone, weighted_sample(ads, Ads::Zones.slots_for(zone)) ]
    end
  end

  def self.weighted_sample(ads, count)
    pool = ads.dup
    picked = []
    while picked.size < count && pool.any?
      choice = weighted_pick(pool)
      picked << choice
      pool.delete(choice)
    end
    picked
  end

  # Weighted random choice. Deterministic-ish caching happens upstream (the API
  # response is revalidated), so a fresh pick per request window is fine.
  def self.weighted_pick(ads)
    total = ads.sum { |a| [ a.weight, 1 ].max }
    target = rand(total)
    cursor = 0
    ads.each do |a|
      cursor += [ a.weight, 1 ].max
      return a if target < cursor
    end
    ads.first
  end

  def has_creative?
    image_url.present? || html.present?
  end
end
