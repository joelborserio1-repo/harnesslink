# frozen_string_literal: true

class Redirect < ApplicationRecord
  validates :from_path, presence: true, uniqueness: true
  validates :to_path, presence: true
  validates :status_code, inclusion: { in: [301, 302, 307, 308] }

  def record_hit!(at: Time.current)
    update_columns(hit_count: hit_count + 1, last_hit_at: at)
  end
end
