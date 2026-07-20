# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class ArchivesTest < ActionDispatch::IntegrationTest
      test "author archive returns the author and their live articles" do
        get "/api/v1/authors/#{authors(:adam).slug}"
        assert_response :success
        body = JSON.parse(response.body)
        assert_equal "Adam Hamilton", body.dig("author", "name")
        assert_includes body["articles"].map { |a| a["slug"] }, articles(:lead).slug
      end

      test "a merged author archive resolves to the canonical one" do
        get "/api/v1/authors/#{authors(:bruce_dup).slug}"
        assert_response :success
        assert_equal "/author/#{authors(:bruce).slug}/", JSON.parse(response.body)["redirect_to"]
      end

      test "unknown author is 404" do
        get "/api/v1/authors/nobody"
        assert_response :not_found
      end

      test "tag archive returns the tag and its articles" do
        get "/api/v1/tags/#{tags(:the_meadowlands).slug}"
        assert_response :success
        body = JSON.parse(response.body)
        assert_equal "The Meadowlands", body.dig("tag", "name")
        assert_includes body["articles"].map { |a| a["slug"] }, articles(:lead).slug
      end

      test "archives sitemap lists category, author and tag URLs" do
        ENV["SITE_URL"] = "https://harnesslink.com"
        get "/api/v1/sitemap/archives"
        assert_response :success
        assert_includes response.body, "https://harnesslink.com/category/usa/"
        assert_includes response.body, "https://harnesslink.com/author/#{authors(:adam).slug}/"
        assert_includes response.body, "https://harnesslink.com/tag/#{tags(:the_meadowlands).slug}/"
      ensure
        ENV.delete("SITE_URL")
      end
    end
  end
end
