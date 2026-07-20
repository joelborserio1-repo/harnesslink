# frozen_string_literal: true

# Logs unmatched incoming paths (genuine 404s) so we can fix real misses from
# real traffic after cutover, rather than guessing.
class CreateMissedPaths < ActiveRecord::Migration[8.1]
  def change
    create_table :missed_paths do |t|
      t.string   :path, null: false
      t.bigint   :hits, null: false, default: 0
      t.string   :referer
      t.datetime :last_seen_at
      t.timestamps
    end
    add_index :missed_paths, :path, unique: true
  end
end
