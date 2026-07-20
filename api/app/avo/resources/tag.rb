class Avo::Resources::Tag < Avo::BaseResource
  self.icon = "tabler/outline/tag"
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
    field :legacy_term_id, as: :number
    field :posts_count, as: :number
    field :articles, as: :has_many, through: :article_tags
  end
end
