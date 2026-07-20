class Avo::Resources::User < Avo::BaseResource
  self.icon = "tabler/outline/users"
  self.title = :email

  # Reader / editorial accounts (distinct from AdminUser Devise logins).
  def fields
    field :id, as: :id
    field :email, as: :text, required: true, link_to_record: true
    field :name, as: :text
    field :role, as: :select, enum: (::User.respond_to?(:roles) ? ::User.roles : { "member" => 0 })
    field :created_at, as: :date_time, readonly: true, hide_on: [:edit, :new], sortable: true
  end
end
