# frozen_string_literal: true

module Directory
  # The directory listing types, mirrored from the WordPress plugin's
  # HLD_Types. `key` is the stored directory_type; `url` is the path segment
  # (/directory/{url}/…) — kept identical to the live site for URL parity.
  module TypeRegistry
    module_function

    TYPES = [
      { key: "stallion",   url: "stallions",       singular: "Stallion",  plural: "Stallions",
        org_label: "Stud",     supports_gait: true,  sort: 10 },
      { key: "trainer",    url: "trainers",        singular: "Trainer",   plural: "Trainers",
        org_label: "Stable",   supports_gait: false, sort: 20 },
      { key: "driver",     url: "drivers",         singular: "Driver",    plural: "Drivers",
        org_label: "Based At", supports_gait: false, sort: 30 },
      { key: "agistment",  url: "agistment",       singular: "Agistment", plural: "Agistment",
        org_label: "Property",  supports_gait: false, sort: 40 },
      { key: "transport",  url: "transport",       singular: "Equine Transport", plural: "Equine Transport",
        org_label: "Operator",  supports_gait: false, sort: 50 },
      { key: "vet",        url: "veterinary",      singular: "Veterinary Service", plural: "Veterinary Services",
        org_label: "Practice",  supports_gait: false, sort: 60 },
      { key: "feed",       url: "feed",            singular: "Feed & Supplements", plural: "Feed & Supplements",
        org_label: "Supplier",  supports_gait: false, sort: 70 },
      { key: "bloodstock", url: "bloodstock",      singular: "Bloodstock Service", plural: "Bloodstock Services",
        org_label: "Agency",    supports_gait: false, sort: 80 },
      { key: "syndicator", url: "syndicators",     singular: "Syndicator", plural: "Syndicators & Ownership Groups",
        org_label: "Group",     supports_gait: false, sort: 90 },
      { key: "breaking",   url: "breaking",        singular: "Breaking & Pre-Training", plural: "Breaking & Pre-Training",
        org_label: "Operation", supports_gait: false, sort: 100 },
      { key: "industry",   url: "industry",        singular: "Industry Service", plural: "Equine Businesses & Industry Services",
        org_label: "Business",  supports_gait: false, sort: 110 }
    ].freeze

    def all
      TYPES
    end

    def by_key(key)
      TYPES.find { |t| t[:key] == key.to_s }
    end

    def by_url(url)
      TYPES.find { |t| t[:url] == url.to_s }
    end

    def keys
      TYPES.map { |t| t[:key] }
    end
  end
end
