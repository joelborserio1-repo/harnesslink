# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class ArticlesApiTest < ActionDispatch::IntegrationTest
      test "index returns live articles as summaries" do
        get "/api/v1/articles"
        assert_response :success
        body = JSON.parse(response.body)
        slugs = body["articles"].map { |a| a["slug"] }
        assert_includes slugs, articles(:lead).slug
        assert_not_includes slugs, articles(:new_draft).slug, "drafts must not be public"
      end

      test "show returns the full article with SEO + byline for a live slug" do
        get "/api/v1/articles/#{articles(:lead).slug}"
        assert_response :success
        a = JSON.parse(response.body).fetch("article")
        assert_equal articles(:lead).title, a["title"]
        assert_equal "/#{articles(:lead).slug}/", a["url"]
        assert_equal "legacy_html", a["body_format"]
        assert a["body_html"].present?
        assert a.dig("seo", "canonical_url").end_with?("/#{articles(:lead).slug}/")
        assert_equal "Adam Hamilton", a["authors"].first["name"]
      end

      test "show 404s for an unknown or non-live slug" do
        get "/api/v1/articles/nope-not-real"
        assert_response :not_found

        get "/api/v1/articles/#{articles(:new_draft).slug}"
        assert_response :not_found
      end

      test "category archive returns its live articles" do
        get "/api/v1/categories/#{categories(:usa).slug}"
        assert_response :success
        body = JSON.parse(response.body)
        assert_equal "USA", body.dig("category", "name")
        assert_includes body["articles"].map { |x| x["slug"] }, articles(:lead).slug
      end
    end
  end
end
