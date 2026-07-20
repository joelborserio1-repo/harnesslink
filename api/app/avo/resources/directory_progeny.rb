class Avo::Resources::DirectoryProgeny < Avo::BaseResource
  self.icon = "tabler/outline/horse"
  self.title = :name

  def fields
    field :id, as: :id
    field :directory_listing, as: :belongs_to
    field :name, as: :text, required: true
    field :sex, as: :text
    field :country, as: :text
    field :prizemoney, as: :text
    field :starts, as: :number
    field :wins, as: :number
    field :sort_order, as: :number, hide_on: :index
  end
end
