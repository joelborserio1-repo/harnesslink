# frozen_string_literal: true

module Ads
  # The reserved ad placements across the site. `key` matches the AdSlot
  # `zone` prop; `size` is the IAB slot the front end reserves. Kept in sync
  # with the AdSlot usages so the admin dropdown offers exactly the real slots.
  module Zones
    ZONES = [
      { key: "home-top",         size: "leaderboard", label: "Home — top leaderboard" },
      { key: "home-mid",         size: "leaderboard", label: "Home — mid leaderboard" },
      { key: "home-bottom",      size: "leaderboard", label: "Home — bottom leaderboard" },
      { key: "home-rail-2",      size: "mpu",         label: "Home — rail MPU" },
      { key: "home-rail-3",      size: "halfpage",    label: "Home — rail half-page" },
      { key: "home-rail-mobile", size: "mpu",         label: "Home — mobile MPU" },
      { key: "article-rail-1",   size: "mpu",         label: "Article — rail MPU (top)" },
      { key: "article-rail-2",   size: "mpu",         label: "Article — rail MPU (mid)" },
      { key: "article-rail-3",   size: "halfpage",    label: "Article — rail half-page" },
      { key: "article-mobile",   size: "mpu",         label: "Article — mobile MPU" }
    ].freeze

    def self.all
      ZONES
    end

    def self.keys
      ZONES.map { |z| z[:key] }
    end

    def self.size_for(key)
      ZONES.find { |z| z[:key] == key }&.dig(:size) || "mpu"
    end
  end
end
