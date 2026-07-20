# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class AdsTest < ActionDispatch::IntegrationTest
      test "index returns one live ad per filled zone, excluding paused/expired" do
        get "/api/v1/ads"
        assert_response :success
        ads_map = JSON.parse(response.body)["ads"]

        assert ads_map.key?("home-top"), "an active, in-window ad fills its zone"
        # home-top has a live ad (leaderboard_a) and an expired one — only the live one is picked.
        assert_equal "/ad/#{ads(:leaderboard_a).id}/click", ads_map["home-top"]["click_url"]
        assert_not ads_map.key?("home-mid"), "paused ad's zone stays empty"
      end

      test "click increments the counter and redirects to the target" do
        ad = ads(:leaderboard_a)
        assert_difference -> { ad.reload.clicks }, 1 do
          get "/api/v1/ads/#{ad.id}/click"
        end
        assert_redirected_to "https://example.com/promo"
      end

      test "click on a missing ad redirects home without error" do
        get "/api/v1/ads/999999/click"
        assert_redirected_to "/"
      end
    end
  end
end
