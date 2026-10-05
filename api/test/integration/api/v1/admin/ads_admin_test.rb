# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Admin
      class AdsAdminTest < ActionDispatch::IntegrationTest
        def auth
          staff_headers(users(:admin))
        end

        test "requires authentication" do
          get "/api/v1/admin/ads"
          assert_response :unauthorized
        end

        test "lists ads and the zone registry" do
          get "/api/v1/admin/ads", headers: auth
          assert_response :success
          body = JSON.parse(response.body)
          assert_includes body["ads"].map { |a| a["name"] }, "Billboard A"
          zone = body["zones"].find { |z| z["key"] == "article-rail" }
          assert_equal 3, zone["slots"]
          assert_equal 300, zone.dig("dimensions", "width")
        end

        test "creates an ad, defaulting size from the zone" do
          assert_difference "Ad.count", 1 do
            post "/api/v1/admin/ads", headers: auth,
                 params: { ad: { name: "New MPU", zone: "article-rail", link_url: "https://x.example",
                                 image_width: 300, image_height: 250 } }
          end
          assert_response :created
          ad = JSON.parse(response.body)["ad"]
          assert_equal "mpu", ad["size"]
          assert_equal [ 300, 250 ], [ ad["image_width"], ad["image_height"] ]
        end

        test "rejects a placement that does not exist" do
          post "/api/v1/admin/ads", headers: auth, params: { ad: { name: "Bad", zone: "home-top" } }
          assert_response :unprocessable_entity
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
