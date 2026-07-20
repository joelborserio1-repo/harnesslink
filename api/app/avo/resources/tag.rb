class Avo::Resources::Tag < Avo::BaseResource
  self.icon = "tabler/outline/tag"
  self.title = :name

  def fields
    field :id, as: :id
    field :name, as: :text, required: true, link_to_record: true
    field :slug, as: :text
    field :legacy_term_id, as: :number, hide_on: :index, readonly: true
    field :articles, as: :has_many, through: :article_tags
  end
end
