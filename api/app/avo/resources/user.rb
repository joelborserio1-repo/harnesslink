class Avo::Resources::User < Avo::BaseResource
  self.icon = "tabler/outline/users"
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
    field :email, as: :text
    field :name, as: :text
    field :role, as: :select, enum: ::User.roles
    field :legacy_wp_user_id, as: :number
    field :article_revisions, as: :has_many
  end
end
