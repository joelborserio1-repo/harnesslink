# frozen_string_literal: true

# Plain serializer (no dependency). Shapes the JSON the Next.js site consumes.
class ArticleSerializer
  def self.summary(article)
    {
      id: article.id,
      slug: article.slug,
      url: "/#{article.slug}/",
      title: article.title,
      subtitle: article.subtitle,
      excerpt: article.excerpt,
      published_at: article.published_at&.iso8601,
      category: category(article.primary_category),
      categories: article.categories.map { |c| category(c) },
      image: image(article.featured_media),
      author: author(article.article_authors.first&.author)
    }
  end

  def self.full(article)
    summary(article).merge(
      body_format: article.body_format,
      body_html: article.body_html,
      body_json: article.body_json,
      modified_at: (article.legacy_modified_at || article.updated_at)&.iso8601,
      authors: article.article_authors.map { |aa| author(aa.author) },
      categories: article.categories.map { |c| category(c) },
      featured_image: image(article.featured_media),
      seo: {
        title: article.seo_title.presence || "#{article.title} | Harnesslink",
        description: article.seo_description,
        canonical_url: article.canonical_url.presence || "https://harnesslink.com/#{article.slug}/",
        robots: article.robots.presence || "index,follow",
        og_title: article.og_title.presence || article.seo_title.presence || article.title,
        og_description: article.og_description.presence || article.seo_description,
        twitter_title: article.twitter_title,
        twitter_description: article.twitter_description,
        schema_type: article.schema_type
      }
    )
  end

  def self.category(cat)
    return nil unless cat
    { name: cat.name, slug: cat.slug, url: "/category/#{cat.slug}/" }
  end

  def self.author(author)
    return nil unless author
    a = author.canonical
    { name: a.name, slug: a.slug, url: "/author/#{a.slug}/" }
  end

  def self.image(media)
    return nil unless media
    { url: media.storage_key, alt: media.alt, width: media.width, height: media.height,
      caption: media.caption, credit: media.credit }
  end
end
