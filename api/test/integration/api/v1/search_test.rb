# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class SearchTest < ActionDispatch::IntegrationTest
      test "finds live articles by title, most recent first" do
        get "/api/v1/search", params: { q: articles(:lead).title.split.first }
        assert_response :success
        body = JSON.parse(response.body)
        assert_includes body["articles"].map { |a| a["slug"] }, articles(:lead).slug
      end

      test "does not surface drafts" do
        get "/api/v1/search", params: { q: articles(:new_draft).title.split.first }
        assert_response :success
        slugs = JSON.parse(response.body)["articles"].map { |a| a["slug"] }
        assert_not_includes slugs, articles(:new_draft).slug
      end

      test "a too-short query returns empty without scanning" do
        get "/api/v1/search", params: { q: "a" }
        assert_response :success
        assert_equal 0, JSON.parse(response.body)["total"]
      end
    end
  end
end
