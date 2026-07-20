# frozen_string_literal: true

require "csv"

module Directory
  # Bulk-imports directory listings from a CSV, matching the WordPress plugin's
  # flexible column names. Idempotent: upserts by (directory_type, slug), so
  # re-uploading updates rather than duplicates. Returns a stats hash.
  #
  # Accepted headers (case-insensitive): name (required), stud|stud_name,
  # country, region, stud_master, type|gait (Pacer/Trotter), status|status_note,
  # is_paying|paying (1/yes/true/y), phone, email, website, address, bio,
  # race_record, progeny.
  class CsvImporter
    Result = Struct.new(:created, :updated, :skipped, :errors, keyword_init: true)

    ALIASES = {
      name: %w[name],
      stud_name: %w[stud_name stud],
      country: %w[country],
      region: %w[region],
      stud_master: %w[stud_master],
      gait: %w[gait type],
      status_note: %w[status_note status],
      is_paying: %w[is_paying paying],
      contact_phone: %w[phone contact_phone],
      contact_email: %w[email contact_email],
      contact_website: %w[website contact_website],
      contact_address: %w[address contact_address],
      profile_bio: %w[bio profile_bio],
      race_record: %w[race_record race\ record],
      progeny_note: %w[progeny progeny_note]
    }.freeze

    def initialize(csv_string, directory_type: "stallion")
      @csv_string = csv_string
      @directory_type = directory_type.presence || "stallion"
    end

    def call
      result = Result.new(created: 0, updated: 0, skipped: 0, errors: [])
      rows = CSV.parse(@csv_string, headers: true, header_converters: ->(h) { h.to_s.strip.downcase })

      rows.each_with_index do |row, i|
        attrs = extract(row)
        if attrs[:name].blank?
          result.skipped += 1
          next
        end
        begin
          upsert(attrs, result)
        rescue StandardError => e
          result.errors << "row #{i + 2}: #{e.message}" # +2: header + 1-index
        end
      end
      result
    end

    private

    def extract(row)
      out = {}
      ALIASES.each do |field, keys|
        key = keys.find { |k| row.headers.include?(k) && row[k].present? }
        out[field] = row[key].to_s.strip if key
      end
      out
    end

    def upsert(attrs, result)
      slug = attrs[:name].parameterize
      listing = DirectoryListing.find_or_initialize_by(directory_type: @directory_type, slug: slug)
      was_new = listing.new_record?

      listing.assign_attributes(
        name: attrs[:name],
        stud_name: attrs[:stud_name].to_s,
        country: attrs[:country].to_s,
        region: attrs[:region].to_s,
        stud_master: attrs[:stud_master].to_s,
        gait: normalize_gait(attrs[:gait]),
        status_note: attrs[:status_note].to_s,
        is_paying: truthy?(attrs[:is_paying]),
        contact_phone: attrs[:contact_phone].to_s,
        contact_email: attrs[:contact_email].to_s,
        contact_website: attrs[:contact_website].to_s,
        contact_address: attrs[:contact_address].to_s,
        profile_bio: attrs[:profile_bio],
        race_record: attrs[:race_record].to_s,
        progeny_note: attrs[:progeny_note]
      )
      listing.save!
      was_new ? result.created += 1 : result.updated += 1
    end

    def normalize_gait(value)
      value.to_s.strip.casecmp("trotter").zero? ? "Trotter" : "Pacer"
    end

    def truthy?(value)
      %w[1 yes true y].include?(value.to_s.strip.downcase)
    end
  end
end
