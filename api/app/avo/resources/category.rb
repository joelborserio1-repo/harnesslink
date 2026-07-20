class Avo::Resources::Category < Avo::BaseResource
  self.icon = "tabler/outline/folder"
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
    field :parent_id, as: :number
    field :kind, as: :select, enum: ::Category.kinds
    field :position, as: :number
    field :description, as: :textarea
    field :legacy_term_id, as: :number
    field :posts_count, as: :number
    field :parent, as: :belongs_to
    field :children, as: :has_many
    field :article_categories, as: :has_many
    field :articles, as: :has_many, through: :article_categories
    field :country, as: :has_one
  end
end
