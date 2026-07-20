# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Admin
      class AdsAdminTest < ActionDispatch::IntegrationTest
        setup do
          @prev = [ENV["ADMIN_USER"], ENV["ADMIN_PASSWORD"]]
          ENV["ADMIN_USER"] = "admin"
          ENV["ADMIN_PASSWORD"] = "secret"
        end

        teardown { ENV["ADMIN_USER"], ENV["ADMIN_PASSWORD"] = @prev }

        def auth
          { "Authorization" => ActionController::HttpAuthentication::Basic.encode_credentials("admin", "secret") }
        end

        test "requires authentication" do
          get "/api/v1/admin/ads"
          assert_response :unauthorized
        end

        test "lists ads and the zone registry" do
          get "/api/v1/admin/ads", headers: auth
          assert_response :success
          body = JSON.parse(response.body)
          assert_includes body["ads"].map { |a| a["name"] }, "Leaderboard A"
          assert_includes body["zones"].map { |z| z["key"] }, "article-rail-1"
        end

        test "creates an ad, defaulting size from the zone" do
          assert_difference "Ad.count", 1 do
            post "/api/v1/admin/ads", headers: auth,
                 params: { ad: { name: "New MPU", zone: "article-rail-2", link_url: "https://x.example" } }
          end
          assert_response :created
          assert_equal "mpu", JSON.parse(response.body).dig("ad", "size")
        end

        test "updates and deletes an ad" do
          ad = ads(:paused)
          patch "/api/v1/admin/ads/#{ad.id}", headers: auth, params: { ad: { is_active: true, weight: 5 } }
          assert_response :success
          assert ad.reload.is_active
          assert_equal 5, ad.weight

          assert_difference "Ad.count", -1 do
            delete "/api/v1/admin/ads/#{ad.id}", headers: auth
          end
          assert_response :no_content
        end
      end
    end
  end
end
