# frozen_string_literal: true

class MissedPath < ApplicationRecord
  validates :path, presence: true, uniqueness: true

  # Upsert-and-increment. Safe to call on every genuine 404.
  def self.record!(raw_path, referer: nil)
    path = raw_path.to_s[0, 2048]
    return nil if path.blank?

    record = find_or_initialize_by(path: path)
    record.hits += 1
    record.referer = referer if referer.present?
    record.last_seen_at = Time.current
    record.save!
    record
  end
end
