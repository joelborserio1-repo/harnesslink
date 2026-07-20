class Avo::Resources::Ad < Avo::BaseResource
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
    field :zone, as: :text
    field :size, as: :text
    field :image_url, as: :text
    field :link_url, as: :text
    field :alt, as: :text
    field :html, as: :textarea
    field :is_active, as: :boolean
    field :starts_at, as: :date_time
    field :ends_at, as: :date_time
    field :weight, as: :number
    field :impressions, as: :number
    field :clicks, as: :number
  end
end
