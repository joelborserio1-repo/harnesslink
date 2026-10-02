# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class PagesApiTest < ActionDispatch::IntegrationTest
      setup do
        Page.create!(path: "privacy-policy", title: "Privacy Policy", body_html: "<p>We respect it.</p>")
        Page.create!(path: "the-insider/editions", title: "Explore Editions", body_html: "<p>x</p>")
        Page.create!(path: "old-draft", title: "Draft", body_html: "<p>x</p>", status: :draft)
      end

      test "serves a published page by path with its SEO fields" do
        get "/api/v1/pages/privacy-policy"
        assert_response :success
        page = JSON.parse(response.body).fetch("page")
        assert_equal "/privacy-policy/", page["url"]
        assert_equal "Privacy Policy - Harnesslink", page.dig("seo", "title")
        assert_equal "https://harnesslink.com/privacy-policy/", page.dig("seo", "canonical_url")
      end

      test "serves a child page by its full path" do
        get "/api/v1/pages/the-insider/editions"
        assert_response :success
        assert_equal "Explore Editions", JSON.parse(response.body).dig("page", "title")
      end

      test "404s for unknown and unpublished pages" do
        get "/api/v1/pages/nope"
        assert_response :not_found
        get "/api/v1/pages/old-draft"
        assert_response :not_found
      end

      test "archive sitemap lists pages and the /country/ archives" do
        get "/api/v1/sitemap/archives"
        assert_includes response.body, "https://harnesslink.com/privacy-policy/"
        assert_not_includes response.body, "old-draft"
        assert_includes response.body, "https://harnesslink.com/country/#{categories(:new_zealand).slug}/"
      end
    end
  end
end
