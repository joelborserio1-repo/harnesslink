# frozen_string_literal: true

require "json"

module Wordpress
  # Imports WordPress users (free subscribers + editorial) into our users table.
  # Idempotent: upserts by legacy_wp_user_id, then by email. Additive; never
  # deletes. Returns a stats hash.
  class UserImporter
    Result = Struct.new(:created, :updated, :skipped, :errors, keyword_init: true)

    def self.from_json(path)
      new(JSON.parse(File.read(path)))
    end

    def initialize(records)
      @records = records
    end

    def call
      result = Result.new(created: 0, updated: 0, skipped: 0, errors: [])
      @records.each_with_index do |raw, i|
        mapper = UserMapper.new(raw)
        unless mapper.valid?
          result.skipped += 1
          next
        end
        begin
          upsert(mapper.call, result)
        rescue StandardError => e
          result.errors << "record #{i + 1}: #{e.message}"
        end
      end
      result
    end

    private

    def upsert(attrs, result)
      user = User.find_by(legacy_wp_user_id: attrs[:legacy_wp_user_id]) ||
             User.find_by("lower(email) = ?", attrs[:email]) ||
             User.new
      was_new = user.new_record?

      # Don't downgrade an existing editorial account to reader on re-import.
      attrs = attrs.except(:role) if !was_new && !user.role_reader?
      # created_at only meaningful on first insert.
      attrs = attrs.except(:created_at) unless was_new

      user.assign_attributes(attrs)
      user.save!
      was_new ? result.created += 1 : result.updated += 1
    end
  end
end
