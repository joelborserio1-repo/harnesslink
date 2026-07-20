class Avo::Resources::DirectoryListing < Avo::BaseResource
  self.icon = "tabler/outline/list-details"
  self.title = :name

  def fields
    field :id, as: :id
    field :name, as: :text, required: true, link_to_record: true
    field :directory_type, as: :select, options: Directory::TypeRegistry.all.to_h { |t| [t[:singular], t[:key]] }
    field :country, as: :text
    field :is_paying, as: :boolean, name: "Paid"
    field :is_featured, as: :boolean, name: "Featured"

    field :slug, as: :text, hide_on: :index
    field :stud_name, as: :text, hide_on: :index
    field :region, as: :text, hide_on: :index
    field :gait, as: :select, options: { "Pacer" => "Pacer", "Trotter" => "Trotter" }, hide_on: :index
    field :service_fee, as: :text, hide_on: :index
    field :race_record, as: :text, hide_on: :index
    field :profile_bio, as: :textarea, hide_on: :index
    field :progeny_note, as: :textarea, hide_on: :index

    field :contact_phone, as: :text, hide_on: :index
    field :contact_email, as: :text, hide_on: :index
    field :contact_website, as: :text, hide_on: :index
    field :contact_address, as: :textarea, hide_on: :index

    field :legacy_id, as: :number, hide_on: :index, readonly: true
    field :progeny, as: :has_many
  end

  def filters
    filter Avo::Filters::DirectoryTypeFilter
    filter Avo::Filters::DirectoryPayingFilter
  end
end
