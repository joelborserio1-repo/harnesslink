# frozen_string_literal: true

# A directory listing (stallion / trainer / driver / service…). Free listings
# show the profile; paid listings (`is_paying`) additionally expose contact
# details. `legacy_id` preserves the WordPress row id used in profile URLs.
class DirectoryListing < ApplicationRecord
  has_many :progeny, -> { order(:sort_order, prizemoney_num: :desc) },
           class_name: "DirectoryProgeny", dependent: :destroy
  has_many :enquiries, class_name: "DirectoryEnquiry", dependent: :nullify

  validates :name, presence: true
  validates :slug, presence: true
  validates :directory_type, inclusion: { in: Directory::TypeRegistry.keys }
  validates :legacy_id, uniqueness: true, allow_nil: true

  before_validation :ensure_slug

  scope :of_type, ->(key) { where(directory_type: key) }
  scope :featured_first, -> { order(is_featured: :desc, name: :asc) }
  scope :in_country, ->(c) { c.present? ? where(country: c) : all }

  # The id used in public URLs — the legacy WordPress id when migrated, else our
  # own — so /directory/{type}/{id}/{slug} keeps resolving old, indexed links.
  def public_id
    legacy_id || id
  end

  def type_config
    Directory::TypeRegistry.by_key(directory_type)
  end

  def path
    url = type_config&.dig(:url) || "listings"
    "/directory/#{url}/#{public_id}/#{slug}/"
  end

  # Look up by the public id (legacy first, then primary key).
  def self.find_by_public_id(pid)
    find_by(legacy_id: pid) || find_by(id: pid)
  end

  private

  def ensure_slug
    self.slug = name.to_s.parameterize if slug.blank? && name.present?
  end
end
