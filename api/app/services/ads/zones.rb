# frozen_string_literal: true

module Ads
  # The ad placements, mirroring harnesslink.com (measured 2 Oct 2026).
  # `key` matches the AdSlot `zone` prop. `format` is the slot shape the front
  # end reserves; `slots` is how many different ads the zone shows at once
  # (rails stack three 300x250 boxes, drawn from the zone's pool without
  # repeats, the way the live site rotates them).
  module Zones
    FORMATS = {
      "billboard" => { width: 1360, height: 150, label: "Full-width banner 1360 × 150" },
      "banner"    => { width: 800,  height: 120, label: "In-column banner 800 × 120" },
      "mpu"       => { width: 300,  height: 250, label: "Box 300 × 250" }
    }.freeze

    ZONES = [
      { key: "home-billboard", format: "billboard", slots: 1, label: "Home — full-width banner under the top stories" },
      { key: "home-mid",       format: "banner",    slots: 1, label: "Home — banner between Trending and International" },
      { key: "home-bottom",    format: "banner",    slots: 1, label: "Home — banner at the foot of the main column" },
      { key: "home-rail",      format: "mpu",       slots: 3, label: "Home — right rail (3 boxes)" },
      { key: "article-top",    format: "banner",    slots: 1, label: "Article — banner above the headline" },
      { key: "article-bottom", format: "banner",    slots: 1, label: "Article — banner after the story" },
      { key: "article-rail",   format: "mpu",       slots: 3, label: "Article — right rail (3 boxes)" },
      { key: "archive-rail",   format: "mpu",       slots: 3, label: "Country, category, writer & tag pages — right rail (3 boxes)" }
    ].freeze

    def self.all
      ZONES.map { |z| z.merge(size: z[:format], dimensions: FORMATS[z[:format]]) }
    end

    def self.keys
      ZONES.map { |z| z[:key] }
    end

    def self.find(key)
      ZONES.find { |z| z[:key] == key }
    end

    def self.size_for(key)
      find(key)&.dig(:format) || "mpu"
    end

    def self.slots_for(key)
      find(key)&.dig(:slots) || 1
    end
  end
end
