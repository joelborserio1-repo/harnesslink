# frozen_string_literal: true

# Admin view of an article — every editable field, plus review state.
class AdminArticleSerializer
  def self.summary(a)
    {
      id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      needs_review: a.needs_review,
      import_flags: a.import_flags,
      published_at: a.published_at&.iso8601,
      primary_category: a.primary_category&.name,
      authors: a.authors.map(&:name)
    }
  end

  def self.full(a)
    summary(a).merge(
      subtitle: a.subtitle,
      excerpt: a.excerpt,
      body_format: a.body_format,
      body_html: a.body_html,
      body_json: a.body_json,
      seo_title: a.seo_title,
      seo_description: a.seo_description,
      focus_keyword: a.focus_keyword,
      canonical_url: a.canonical_url,
      robots: a.robots,
      og_title: a.og_title,
      og_description: a.og_description,
      twitter_title: a.twitter_title,
      twitter_description: a.twitter_description,
      schema_type: a.schema_type,
      primary_category_id: a.primary_category_id,
      category_ids: a.category_ids,
      tag_ids: a.tag_ids,
      author_ids: a.article_authors.order(:position).pluck(:author_id),
      legacy_wp_id: a.legacy_wp_id,
      legacy_url: a.legacy_url
    )
  end
end
