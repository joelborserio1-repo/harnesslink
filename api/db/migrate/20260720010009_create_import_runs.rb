# frozen_string_literal: true

# Checkpoint for the WordPress importer so a run over 60k+ posts can resume
# from where it stopped (it will fail partway through at least once).
class CreateImportRuns < ActiveRecord::Migration[8.1]
  def change
    create_table :import_runs do |t|
      t.string   :source, null: false, default: "wordpress"
      t.integer  :status, null: false, default: 0 # running / completed / failed
      t.bigint   :cursor_legacy_id, null: false, default: 0 # highest wp post id done
      t.jsonb    :stats, null: false, default: {}
      t.text     :last_error
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps
    end
  end
end
