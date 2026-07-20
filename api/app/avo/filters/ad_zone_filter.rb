class Avo::Filters::AdZoneFilter < Avo::Filters::SelectFilter
  self.name = "Zone"

  def apply(request, query, value)
    return query if value.blank?
    query.where(zone: value)
  end

  def options
    Ads::Zones.all.to_h { |z| [z[:key], z[:label]] }
  end
end
