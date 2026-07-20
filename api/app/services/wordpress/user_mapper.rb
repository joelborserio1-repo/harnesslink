# frozen_string_literal: true

module Wordpress
  # Maps one exported WordPress user record to our User attributes. Pure/no DB.
  # Passwords are NOT migrated (WP phpass can't convert to our scheme) — free
  # readers authenticate via magic-link, so imported accounts have none.
  class UserMapper
    # WordPress role => our role. Anything unrecognised is a free reader.
    ROLE_MAP = {
      "administrator" => :admin,
      "editor" => :editor,
      "author" => :contributor,
      "contributor" => :contributor
    }.freeze

    def initialize(record)
      @r = record.transform_keys(&:to_s)
    end

    def call
      {
        legacy_wp_user_id: @r["id"].to_i,
        email: @r["email"].to_s.strip.downcase,
        name: display_name,
        role: role,
        created_at: parse_time(@r["registered"])
      }.compact
    end

    def valid?
      @r["email"].to_s.include?("@")
    end

    private

    def display_name
      @r["display_name"].presence || @r["login"].presence || @r["email"].to_s.split("@").first
    end

    def role
      roles = Array(@r["roles"]).map { |x| x.to_s.downcase }
      roles.filter_map { |x| ROLE_MAP[x] }.first || :reader
    end

    def parse_time(value)
      return nil if value.blank?
      Time.zone.parse(value.to_s)
    rescue ArgumentError
      nil
    end
  end
end
