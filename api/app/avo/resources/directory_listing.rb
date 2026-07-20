class Avo::Resources::DirectoryListing < Avo::BaseResource
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
    field :directory_type, as: :text
    field :name, as: :text
    field :slug, as: :text
    field :stud_name, as: :text
    field :country, as: :country
    field :region, as: :text
    field :stud_master, as: :text
    field :suburb, as: :text
    field :industry, as: :text
    field :coverage, as: :textarea
    field :gait, as: :text
    field :status_note, as: :text
    field :is_paying, as: :boolean
    field :is_featured, as: :boolean
    field :contact_phone, as: :text
    field :contact_email, as: :text
    field :contact_website, as: :text
    field :stud_website, as: :text
    field :contact_address, as: :textarea
    field :profile_bio, as: :textarea
    field :profile_image, as: :text
    field :race_record, as: :text
    field :service_fee, as: :text
    field :progeny_note, as: :textarea
    field :legacy_id, as: :number
    field :progeny, as: :has_many
    field :enquiries, as: :has_many
  end
end
