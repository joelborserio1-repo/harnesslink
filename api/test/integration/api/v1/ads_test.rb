# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class AdsTest < ActionDispatch::IntegrationTest
      test "index returns the live ads per filled zone, excluding paused/expired" do
        get "/api/v1/ads"
        assert_response :success
        ads_map = JSON.parse(response.body)["ads"]

        # home-billboard has a live ad and an expired one — only the live one.
        assert_equal 1, ads_map["home-billboard"].size
        billboard = ads_map["home-billboard"].first
        assert_equal "/ad/#{ads(:billboard_a).id}/click", billboard["click_url"]
        assert_equal [ 1360, 150 ], [ billboard["width"], billboard["height"] ]
        assert_not ads_map.key?("home-mid"), "paused ad's zone stays empty"
      end

      test "a rail shows three different ads from its pool" do
        20.times do
          get "/api/v1/ads"
          rail = JSON.parse(response.body).dig("ads", "article-rail")
          assert_equal 3, rail.size
          assert_equal 3, rail.map { |c| c["id"] }.uniq.size, "never the same advertiser twice in one rail"
        end
      end

      test "click increments the counter and redirects to the target" do
        ad = ads(:billboard_a)
        assert_difference -> { ad.reload.clicks }, 1 do
          get "/api/v1/ads/#{ad.id}/click"
        end
        assert_redirected_to "https://example.com/promo"
      end

      test "click on a missing ad redirects home without error" do
        get "/api/v1/ads/999999/click"
        assert_redirected_to "/"
      end

      test "impression beacon increments the counter" do
        ad = ads(:billboard_a)
        assert_difference -> { ad.reload.impressions }, 1 do
          post "/api/v1/ads/#{ad.id}/impression"
        end
        assert_response :no_content
      end
    end
  end
end
