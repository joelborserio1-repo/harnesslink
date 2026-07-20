# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class SitemapsTest < ActionDispatch::IntegrationTest
      setup do
        @prev = ENV["SITE_URL"]
        ENV["SITE_URL"] = "https://harnesslink.com"
      end

      teardown { ENV["SITE_URL"] = @prev }

      test "sitemap index lists the article sitemaps and the news sitemap" do
        get "/api/v1/sitemap"
        assert_response :success
        assert_equal "application/xml", response.media_type
        assert_includes response.body, "<sitemapindex"
        assert_includes response.body, "https://harnesslink.com/sitemap-articles-1.xml"
        assert_includes response.body, "https://harnesslink.com/news-sitemap.xml"
      end

      test "article sitemap lists article URLs with lastmod at the real path" do
        get "/api/v1/sitemap/articles/1"
        assert_response :success
        assert_includes response.body, "<urlset"
        assert_includes response.body, "https://harnesslink.com/#{articles(:lead).slug}/"
        assert_includes response.body, "<lastmod>"
        assert_not_includes response.body, articles(:new_draft).slug # drafts excluded
      end

      test "news sitemap includes recent articles with the news namespace" do
        recent = Article.create!(title: "Fresh Result", slug: "fresh-result",
                                 body_format: :legacy_html, body_html: "<p>x</p>",
                                 status: :published, published_at: 1.hour.ago)
        get "/api/v1/sitemap/news"
        assert_response :success
        assert_includes response.body, "xmlns:news="
        assert_includes response.body, "https://harnesslink.com/#{recent.slug}/"
        assert_includes response.body, "<news:title>Fresh Result</news:title>"
      end

      test "RSS feed renders channel and items" do
        get "/api/v1/feed"
        assert_response :success
        assert_includes response.body, "<rss"
        assert_includes response.body, "<title>Harnesslink</title>"
        assert_includes response.body, articles(:lead).title.gsub("$", "$")
        assert_includes response.body, "https://harnesslink.com/#{articles(:lead).slug}/"
      end

      test "XML escaping is applied to titles" do
        Article.create!(title: "Fish & Chips <b>win</b>", slug: "fish-chips",
                        body_format: :legacy_html, body_html: "<p>x</p>",
                        status: :published, published_at: 30.minutes.ago)
        get "/api/v1/feed"
        assert_includes response.body, "Fish &amp; Chips &lt;b&gt;win&lt;/b&gt;"
      end
    end
  end
end
