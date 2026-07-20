# frozen_string_literal: true

class Redirect < ApplicationRecord
  validates :from_path, presence: true, uniqueness: true
  validates :to_path, presence: true
  validates :status_code, inclusion: { in: [301, 302, 307, 308] }

  # Look up a redirect for an incoming path, tolerating the trailing slash so
  # /foo and /foo/ resolve the same (WordPress permalinks are /%postname%/).
  def self.resolve(raw_path)
    path = normalize_path(raw_path)
    return nil if path.blank?

    find_by(from_path: path) || find_by(from_path: toggle_trailing_slash(path))
  end

  def self.normalize_path(raw)
    p = raw.to_s.split("?").first.to_s.split("#").first.to_s
    return "" if p.empty?
    p = "/#{p}" unless p.start_with?("/")
    p
  end

  def self.toggle_trailing_slash(path)
    return path if path == "/"
    path.end_with?("/") ? path.chomp("/") : "#{path}/"
  end

  def record_hit!(at: Time.current)
    update_columns(hit_count: hit_count + 1, last_hit_at: at)
  end
end
