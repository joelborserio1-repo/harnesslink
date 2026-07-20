class Avo::Resources::Author < Avo::BaseResource
  self.icon = "tabler/outline/user"
  self.title = :name

  def fields
    field :id, as: :id
    field :name, as: :text, required: true, link_to_record: true
    field :slug, as: :text
    field :role_title, as: :text
    field :bio, as: :textarea, hide_on: :index
    field :legacy_refs, as: :code, hide_on: [:index, :edit]
    field :merged_into, as: :belongs_to, help: "Set to fold this duplicate into a canonical author"
    field :aliases, as: :has_many
    field :articles, as: :has_many, through: :article_authors
  end
end
