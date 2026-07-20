class Avo::Resources::MediaAsset < Avo::BaseResource
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
    field :legacy_wp_id, as: :number
    field :legacy_url, as: :text
    field :storage_key, as: :text
    field :mime_type, as: :text
    field :width, as: :number
    field :height, as: :number
    field :byte_size, as: :number
    field :title, as: :text
    field :alt, as: :text
    field :caption, as: :textarea
    field :credit, as: :text
    field :blurhash, as: :text
    field :status, as: :select, enum: ::MediaAsset.statuses
  end
end
