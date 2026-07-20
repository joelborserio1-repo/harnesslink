class Avo::Resources::Category < Avo::BaseResource
  self.icon = "tabler/outline/folder"
  self.title = :name

  def fields
    field :id, as: :id
    field :name, as: :text, required: true, link_to_record: true
    field :slug, as: :text
    field :kind, as: :select, enum: ::Category.kinds
    field :position, as: :number
    field :legacy_term_id, as: :number, hide_on: :index, readonly: true
    field :parent, as: :belongs_to
    field :articles, as: :has_many, through: :article_categories
  end
end
