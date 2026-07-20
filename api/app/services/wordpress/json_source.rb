# frozen_string_literal: true

module Wordpress
  # Reads posts from a JSON file produced by migration/export_posts.php. Lets us
  # run the real import from an export the user uploads — no live MySQL needed.
  class JsonSource
    def initialize(path:)
      @path = path
    end

    def each_post(after_id: 0)
      records = JSON.parse(File.read(@path)).map { |h| normalize(h) }.sort_by { |r| r[:id].to_i }
      records.each { |r| yield r if r[:id].to_i > after_id.to_i }
    end

    private

    def normalize(h)
      {
        id: h["id"].to_i,
        post_name: h["post_name"],
        post_title: h["post_title"],
        post_content: h["post_content"],
        post_excerpt: h["post_excerpt"],
        post_date: parse_time(h["post_date"]),
        post_modified: parse_time(h["post_modified"]),
        post_status: h["post_status"],
        post_type: h["post_type"],
        meta: h["meta"] || {},
        categories: terms(h["categories"]),
        tags: terms(h["tags"]),
        authors: (h["authors"] || []).map { |a| { name: a["name"], slug: a["slug"], refs: a["refs"] || {} } },
        old_slugs: h["old_slugs"] || [],
        featured: featured(h["featured"])
      }
    end

    def featured(f)
      return nil if f.blank?
      { legacy_id: f["legacy_id"], url: f["url"], width: f["width"],
        height: f["height"], alt: f["alt"], mime_type: f["mime_type"] }
    end

    def terms(arr)
      (arr || []).map do |t|
        { name: t["name"], slug: t["slug"], legacy_term_id: t["legacy_term_id"], kind: t["kind"]&.to_sym }
      end
    end

    def parse_time(value)
      return nil if value.blank?
      Time.zone.parse(value.to_s)
    rescue ArgumentError
      nil
    end
  end
end
