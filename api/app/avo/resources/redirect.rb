class Avo::Resources::Redirect < Avo::BaseResource
  self.icon = "tabler/outline/arrow-right"
  self.title = :from_path

  def fields
    field :id, as: :id
    field :from_path, as: :text, required: true, link_to_record: true
    field :to_path, as: :text, required: true
    field :status_code, as: :number
    field :reason, as: :text
  end
end
