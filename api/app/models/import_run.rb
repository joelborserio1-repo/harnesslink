# frozen_string_literal: true

class ImportRun < ApplicationRecord
  enum :status, { running: 0, completed: 1, failed: 2 }, prefix: true

  DEFAULT_STATS = {
    "posts_seen" => 0, "articles_imported" => 0, "authors" => 0,
    "categories" => 0, "tags" => 0, "redirects" => 0, "media" => 0,
    "flagged" => 0, "errors" => 0
  }.freeze

  def self.start!(source: "wordpress", resume: true)
    if resume && (run = where(source: source).status_running.order(:id).last)
      return run
    end
    create!(source: source, status: :running, started_at: Time.current, stats: DEFAULT_STATS.dup)
  end

  def bump(key, by = 1)
    self.stats = DEFAULT_STATS.merge(stats)
    stats[key.to_s] = stats.fetch(key.to_s, 0) + by
  end

  def checkpoint!(legacy_id)
    self.cursor_legacy_id = legacy_id if legacy_id.to_i > cursor_legacy_id.to_i
    save!
  end

  def finish!(error: nil)
    update!(status: error ? :failed : :completed, finished_at: Time.current, last_error: error)
  end
end
