class Avo::Resources::MediaAsset < Avo::BaseResource
  self.icon = "tabler/outline/photo"
  self.title = :legacy_url

  def fields
    field :id, as: :id
    field :legacy_url, as: :text, link_to_record: true
    field :mime_type, as: :text
    field :width, as: :number
    field :height, as: :number
    field :alt, as: :text, hide_on: :index
    field :caption, as: :textarea, hide_on: :index
    field :credit, as: :text, hide_on: :index
    field :legacy_wp_id, as: :number, hide_on: :index, readonly: true
  end
end
