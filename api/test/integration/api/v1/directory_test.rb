# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class DirectoryTest < ActionDispatch::IntegrationTest
      test "hub lists the types with listing counts" do
        get "/api/v1/directory"
        assert_response :success
        body = JSON.parse(response.body)
        stallions = body["types"].find { |t| t["key"] == "stallion" }
        assert_equal "stallions", stallions["url"]
        assert_equal 2, stallions["count"]
        assert_equal 3, body["total"]
      end

      test "type archive returns listings of that type, featured first" do
        get "/api/v1/directory/stallions"
        assert_response :success
        body = JSON.parse(response.body)
        assert_equal "stallion", body.dig("type", "key")
        names = body["listings"].map { |l| l["name"] }
        assert_includes names, "Bettor's Delight"
        assert_includes names, "Sweet Lou"
        assert_equal "Bettor's Delight", names.first, "featured listing sorts first"
      end

      test "unknown type is 404" do
        get "/api/v1/directory/unicorns"
        assert_response :not_found
      end

      test "a paid profile exposes contact details" do
        get "/api/v1/directory/stallions/#{directory_listings(:bettors_delight).legacy_id}"
        assert_response :success
        listing = JSON.parse(response.body)["listing"]
        assert_equal "Bettor's Delight", listing["name"]
        assert_equal "studmaster@example.com", listing.dig("contact", "email")
        assert_includes listing["progeny"].map { |p| p["name"] }, "Spankem"
      end

      test "a free profile hides contact details" do
        get "/api/v1/directory/stallions/#{directory_listings(:sweet_lou).legacy_id}"
        assert_response :success
        listing = JSON.parse(response.body)["listing"]
        assert_nil listing["contact"], "free listings must not expose contact info"
      end

      test "profile resolves by legacy id (URL parity)" do
        get "/api/v1/directory/stallions/1000"
        assert_response :success
        assert_equal "Bettor's Delight", JSON.parse(response.body).dig("listing", "name")
      end
    end
  end
end
