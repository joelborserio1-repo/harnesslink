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
        # Author box needs role/bio; article page needs tags + a related set.
        assert_equal "Contributor", a["authors"].first["role_title"]
        assert_includes a["tags"].map { |t| t["name"] }, "The Meadowlands"
        assert_equal "/tag/the-meadowlands/", a["tags"].first["url"]
        assert_kind_of Array, a["related"], "related must always be present (possibly empty)"
        assert_not_includes a["related"].map { |r| r["slug"] }, articles(:lead).slug,
                            "related must never include the article itself"
      end

      test "view beacon increments the counter" do
        article = articles(:lead)
        assert_difference -> { article.reload.view_count }, 1 do
          post "/api/v1/articles/#{article.slug}/view"
        end
        assert_response :no_content
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
