class Avo::Resources::Redirect < Avo::BaseResource
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
    field :from_path, as: :text
    field :to_path, as: :text
    field :status_code, as: :number
    field :hit_count, as: :number
    field :last_hit_at, as: :date_time
    field :reason, as: :text
  end
end
