class Avo::Resources::Ad < Avo::BaseResource
  self.icon = "tabler/outline/photo"
  self.title = :name

  def fields
    field :id, as: :id
    field :name, as: :text, required: true, link_to_record: true
    field :zone, as: :select, options: Ads::Zones.all.to_h { |z| [z[:label], z[:key]] }
    field :is_active, as: :boolean, name: "Active"
    field :weight, as: :number
    field :clicks, as: :number, readonly: true
    field :impressions, as: :number, readonly: true, hide_on: :index

    field :size, as: :text, hide_on: :index, help: "Auto-set from the zone if blank"
    field :image_url, as: :textarea, hide_on: :index, help: "Creative URL or data: URI"
    field :link_url, as: :text, hide_on: :index
    field :alt, as: :text, hide_on: :index
    field :html, as: :code, hide_on: :index, help: "Optional raw HTML creative (overrides image)"
    field :starts_at, as: :date_time, hide_on: :index
    field :ends_at, as: :date_time, hide_on: :index
  end

  def filters
    filter Avo::Filters::AdZoneFilter
    filter Avo::Filters::AdActiveFilter
  end
end
