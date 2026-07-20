class Avo::Resources::Article < Avo::BaseResource
  self.icon = "tabler/outline/article"
  self.title = :title

  def fields
    field :id, as: :id
    field :title, as: :text, required: true, link_to_record: true
    field :status, as: :select, enum: ::Article.statuses
    field :needs_review, as: :boolean
    field :published_at, as: :date_time, sortable: true
    field :primary_category, as: :belongs_to

    field :slug, as: :text, hide_on: :index
    field :subtitle, as: :text, hide_on: :index
    field :excerpt, as: :textarea, hide_on: :index
    field :body_format, as: :select, enum: ::Article.body_formats, hide_on: :index
    field :body_html, as: :textarea, hide_on: :index
    field :import_flags, as: :code, hide_on: [:index, :edit]

    field :seo_title, as: :text, hide_on: :index
    field :seo_description, as: :textarea, hide_on: :index
    field :canonical_url, as: :text, hide_on: :index
    field :robots, as: :text, hide_on: :index

    field :legacy_wp_id, as: :number, hide_on: :index, readonly: true
    field :legacy_url, as: :text, hide_on: :index, readonly: true

    field :categories, as: :has_many, through: :article_categories
    field :authors, as: :has_many, through: :article_authors
  end

  def filters
    filter Avo::Filters::ArticleStatusFilter
    filter Avo::Filters::ArticleNeedsReviewFilter
  end
end
