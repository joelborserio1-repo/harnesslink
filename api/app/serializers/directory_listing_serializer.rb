# frozen_string_literal: true

# Shapes directory listings for the API. Contact details are only exposed for
# paid listings (is_paying) — the free/paid gating from the WordPress plugin.
class DirectoryListingSerializer
  def self.summary(listing)
    t = listing.type_config || {}
    {
      id: listing.public_id,
      slug: listing.slug,
      name: listing.name,
      directory_type: listing.directory_type,
      type_label: t[:singular],
      org_label: t[:org_label],
      stud_name: listing.stud_name.presence,
      country: listing.country.presence,
      region: listing.region.presence,
      gait: t[:supports_gait] ? listing.gait : nil,
      is_paying: listing.is_paying,
      is_featured: listing.is_featured,
      profile_image: listing.profile_image.presence,
      path: listing.path
    }
  end

  def self.full(listing)
    data = summary(listing).merge(
      stud_master: listing.stud_master.presence,
      suburb: listing.suburb.presence,
      industry: listing.industry.presence,
      coverage: listing.coverage.presence,
      status_note: listing.status_note.presence,
      profile_bio: listing.profile_bio.presence,
      race_record: listing.race_record.presence,
      service_fee: listing.service_fee.presence,
      progeny_note: listing.progeny_note.presence,
      progeny: listing.progeny.map { |p| progeny(p) }
    )
    # Contact details are a paid-tier feature.
    if listing.is_paying
      data[:contact] = {
        phone: listing.contact_phone.presence,
        email: listing.contact_email.presence,
        website: listing.contact_website.presence,
        stud_website: listing.stud_website.presence,
        address: listing.contact_address.presence
      }.compact
    end
    data
  end

  def self.progeny(p)
    {
      name: p.name, foaling_date: p.foaling_date.presence, country: p.country.presence,
      sex: p.sex.presence, dam: p.dam.presence, broodmare_sire: p.broodmare_sire.presence,
      prizemoney: p.prizemoney.presence, mile_rate: p.mile_rate.presence,
      starts: p.starts, wins: p.wins
    }
  end
end
