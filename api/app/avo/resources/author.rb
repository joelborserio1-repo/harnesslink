class Avo::Resources::Author < Avo::BaseResource
  # self.icon = "tabler/outline/users"
  # self.avatar = {
  #   source: :avatar
  # }
  # self.includes = []
  # self.attachments = []
  # self.search = {
  #   query: -> { query.ransack(id_eq: q, m: "or").result(distinct: false) }
  # }

  def fields
    field :id, as: :id
    # field :avatar, as: :avatar
    field :name, as: :text
    field :slug, as: :text
    field :bio, as: :textarea
    field :email, as: :text
    field :avatar_url, as: :text
    field :twitter, as: :text
    field :role_title, as: :text
    field :position, as: :number
    field :legacy_refs, as: :code
    field :merged_into_id, as: :number
    field :merged_into, as: :belongs_to
    field :aliases, as: :has_many
    field :article_authors, as: :has_many
    field :articles, as: :has_many, through: :article_authors
  end
end
