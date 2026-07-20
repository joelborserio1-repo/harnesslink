class Avo::Resources::Article < Avo::BaseResource
  self.icon = "tabler/outline/article"
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
    field :title, as: :text
    field :subtitle, as: :text
    field :slug, as: :text
    field :excerpt, as: :textarea
    field :body_format, as: :select, enum: ::Article.body_formats
    field :body_html, as: :textarea
    field :body_json, as: :code
    field :status, as: :select, enum: ::Article.statuses
    field :published_at, as: :date_time
    field :scheduled_for, as: :date_time
    field :legacy_modified_at, as: :date_time
    field :primary_category_id, as: :number
    field :featured_media_id, as: :number
    field :featured_image_caption, as: :text
    field :featured_image_credit, as: :text
    field :byline_text, as: :text
    field :reading_time_minutes, as: :number
    field :view_count, as: :number
    field :seo_title, as: :text
    field :seo_description, as: :textarea
    field :focus_keyword, as: :text
    field :canonical_url, as: :text
    field :robots, as: :text
    field :og_title, as: :text
    field :og_description, as: :textarea
    field :og_image_id, as: :number
    field :twitter_title, as: :text
    field :twitter_description, as: :textarea
    field :twitter_image_id, as: :number
    field :schema_type, as: :text
    field :legacy_wp_id, as: :number
    field :legacy_url, as: :text
    field :legacy_source, as: :text
    field :needs_review, as: :boolean
    field :import_flags, as: :code
    field :primary_category, as: :belongs_to
    field :featured_media, as: :belongs_to
    field :og_image, as: :belongs_to
    field :twitter_image, as: :belongs_to
    field :article_categories, as: :has_many
    field :categories, as: :has_many, through: :article_categories
    field :article_authors, as: :has_many
    field :authors, as: :has_many, through: :article_authors
    field :article_revisions, as: :has_many
  end
end
