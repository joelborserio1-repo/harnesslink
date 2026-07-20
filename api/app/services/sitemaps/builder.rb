# frozen_string_literal: true

module Sitemaps
  # Generates the XML that SEO depends on: a paginated sitemap index, per-page
  # article sitemaps, a Google News sitemap (last 48h), and the RSS feed.
  # Plain string building (no dependency), with proper escaping.
  module Builder
    PER_PAGE = 10_000
    NEWS_WINDOW = 48.hours
    NEWS_MAX = 1000
    FEED_MAX = 50

    module_function

    def site_url
      ENV.fetch("SITE_URL", "https://harnesslink.com").chomp("/")
    end

    def loc(slug)
      "#{site_url}/#{slug}/"
    end

    def esc(str)
      str.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub('"', "&quot;")
    end

    def page_count
      [(Article.live.count / PER_PAGE.to_f).ceil, 1].max
    end

    # ---- sitemap index ----
    def index_xml
      entries = (1..page_count).map { |p| "<sitemap><loc>#{site_url}/sitemap-articles-#{p}.xml</loc></sitemap>" }
      entries << "<sitemap><loc>#{site_url}/news-sitemap.xml</loc></sitemap>"
      entries << "<sitemap><loc>#{site_url}/archives-sitemap.xml</loc></sitemap>"
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{entries.join("\n")}
        </sitemapindex>
      XML
    end

    # ---- per-page article sitemap ----
    def articles_xml(page)
      page = [page.to_i, 1].max
      rows = Article.live.order(:id).offset((page - 1) * PER_PAGE).limit(PER_PAGE)
                    .pluck(:slug, :legacy_modified_at, :updated_at, :published_at)
      urls = rows.map do |slug, modified, updated, published|
        lastmod = (modified || updated || published)&.iso8601
        +"<url><loc>#{loc(slug)}</loc>" \
          "#{lastmod ? "<lastmod>#{lastmod}</lastmod>" : ''}" \
          "<changefreq>weekly</changefreq></url>"
      end
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{urls.join("\n")}
        </urlset>
      XML
    end

    # ---- archive sitemap (category / author / tag archive URLs) ----
    def archives_xml
      paths = []
      Category.order(:id).pluck(:slug).each { |s| paths << "/category/#{s}/" }
      # DISTINCT requires the ORDER BY column in the select list, so order by
      # the slug we're plucking rather than id.
      Author.where(merged_into_id: nil).joins(:article_authors).distinct.order(:slug).pluck(:slug).each { |s| paths << "/author/#{s}/" }
      Tag.joins(:article_tags).distinct.order(:slug).pluck(:slug).each { |s| paths << "/tag/#{s}/" }

      # Directory — hub, type archives, and each listing profile (URL parity).
      paths << "/directory/"
      Directory::TypeRegistry.all.each do |t|
        next unless DirectoryListing.exists?(directory_type: t[:key])
        paths << "/directory/#{t[:url]}/"
      end
      DirectoryListing.find_each { |l| paths << l.path }

      urls = paths.uniq.map { |p| "<url><loc>#{site_url}#{p}</loc><changefreq>daily</changefreq></url>" }
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{urls.join("\n")}
        </urlset>
      XML
    end

    # ---- Google News sitemap (last 48h) ----
    def news_xml
      articles = Article.live.where(published_at: NEWS_WINDOW.ago..Time.current)
                        .recent_first.limit(NEWS_MAX)
      urls = articles.map do |a|
        <<~URL.strip
          <url><loc>#{loc(a.slug)}</loc>
          <news:news>
          <news:publication><news:name>Harnesslink</news:name><news:language>en</news:language></news:publication>
          <news:publication_date>#{a.published_at.iso8601}</news:publication_date>
          <news:title>#{esc(a.title)}</news:title>
          </news:news></url>
        URL
      end
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
        #{urls.join("\n")}
        </urlset>
      XML
    end

    # ---- RSS 2.0 feed ----
    def feed_xml
      articles = Article.live.includes(:primary_category, article_authors: :author)
                        .recent_first.limit(FEED_MAX)
      items = articles.map do |a|
        author = a.article_authors.first&.author
        <<~ITEM.strip
          <item>
          <title>#{esc(a.title)}</title>
          <link>#{loc(a.slug)}</link>
          <guid isPermaLink="true">#{loc(a.slug)}</guid>
          <pubDate>#{a.published_at&.rfc822}</pubDate>
          #{author ? "<dc:creator>#{esc(author.name)}</dc:creator>" : ''}
          #{a.primary_category ? "<category>#{esc(a.primary_category.name)}</category>" : ''}
          <description>#{esc(a.excerpt)}</description>
          </item>
        ITEM
      end
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel>
        <title>Harnesslink</title>
        <link>#{site_url}/</link>
        <description>Harness racing's global news source.</description>
        <language>en</language>
        <lastBuildDate>#{Time.current.rfc822}</lastBuildDate>
        #{items.join("\n")}
        </channel>
        </rss>
      XML
    end
  end
end
