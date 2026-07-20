# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Admin
      class ArticlesAdminTest < ActionDispatch::IntegrationTest
        setup do
          @prev = [ENV["ADMIN_USER"], ENV["ADMIN_PASSWORD"]]
          ENV["ADMIN_USER"] = "admin"
          ENV["ADMIN_PASSWORD"] = "secret"
        end

        teardown do
          ENV["ADMIN_USER"], ENV["ADMIN_PASSWORD"] = @prev
        end

        def auth
          { "Authorization" => ActionController::HttpAuthentication::Basic.encode_credentials("admin", "secret") }
        end

        test "requires authentication" do
          get "/api/v1/admin/articles"
          assert_response :unauthorized
        end

        test "rejects wrong credentials" do
          get "/api/v1/admin/articles",
              headers: { "Authorization" => ActionController::HttpAuthentication::Basic.encode_credentials("admin", "nope") }
          assert_response :unauthorized
        end

        test "lists articles when authenticated" do
          get "/api/v1/admin/articles", headers: auth
          assert_response :success
          body = JSON.parse(response.body)
          assert_includes body["articles"].map { |a| a["slug"] }, articles(:lead).slug
        end

        test "filters by needs_review" do
          articles(:new_draft).update!(needs_review: true)
          get "/api/v1/admin/articles", params: { needs_review: "true" }, headers: auth
          slugs = JSON.parse(response.body)["articles"].map { |a| a["slug"] }
          assert_includes slugs, articles(:new_draft).slug
          assert_not_includes slugs, articles(:lead).slug
        end

        test "updates fields, byline order and clears the review flag" do
          articles(:lead).update!(needs_review: true)
          patch "/api/v1/admin/articles/#{articles(:lead).id}",
                params: { article: { title: "Edited headline", status: "published",
                                     needs_review: false, author_ids: [authors(:bruce).id, authors(:adam).id] } },
                headers: auth
          assert_response :success

          lead = articles(:lead).reload
          assert_equal "Edited headline", lead.title
          assert_not lead.needs_review
          assert_equal [authors(:bruce).id, authors(:adam).id],
                       lead.article_authors.order(:position).pluck(:author_id)
        end

        test "returns validation errors" do
          patch "/api/v1/admin/articles/#{articles(:lead).id}",
                params: { article: { slug: "" } }, headers: auth
          assert_response :unprocessable_entity
          assert JSON.parse(response.body)["errors"].present?
        end
      end
    end
  end
end
