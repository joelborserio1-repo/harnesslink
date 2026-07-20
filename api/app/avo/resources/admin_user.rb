class Avo::Resources::AdminUser < Avo::BaseResource
  self.icon = "tabler/outline/shield-lock"
  self.title = :email

  def fields
    field :id, as: :id
    field :email, as: :text, required: true, link_to_record: true
    field :password, as: :password, only_on: [:new], help: "Set at creation; change later via reset"
    field :created_at, as: :date_time, readonly: true, hide_on: [:edit, :new]
  end
end
