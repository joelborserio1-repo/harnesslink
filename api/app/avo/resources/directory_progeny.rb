class Avo::Resources::DirectoryProgeny < Avo::BaseResource
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
    field :directory_listing_id, as: :number
    field :name, as: :text
    field :foaling_date, as: :text
    field :country, as: :country
    field :sex, as: :text
    field :dam, as: :text
    field :broodmare_sire, as: :text
    field :prizemoney, as: :text
    field :prizemoney_num, as: :number
    field :mile_rate, as: :text
    field :starts, as: :number
    field :wins, as: :number
    field :sort_order, as: :number
    field :directory_listing, as: :belongs_to
  end
end
