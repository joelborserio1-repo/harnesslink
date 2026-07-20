# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class RedirectsApiTest < ActionDispatch::IntegrationTest
      test "resolve returns the target and counts a hit for a known path" do
        r = redirects(:old_slug)
        assert_difference -> { r.reload.hit_count }, 1 do
          get "/api/v1/redirects/resolve", params: { path: r.from_path }
        end
        assert_response :success
        body = JSON.parse(response.body)
        assert body["redirect"]
        assert_equal 301, body["status"]
        assert_equal r.to_path, body["location"]
      end

      test "resolve returns redirect:false for an unknown path (not a 404)" do
        get "/api/v1/redirects/resolve", params: { path: "/valid-article-maybe/" }
        assert_response :success
        assert_equal false, JSON.parse(response.body)["redirect"]
      end

      test "the Rack middleware 301s a legacy path hitting the API host" do
        r = redirects(:old_slug)
        get r.from_path
        assert_response :moved_permanently
        assert_equal r.to_path, response.headers["Location"]
      end

      test "missed_paths logs a genuine 404" do
        assert_difference -> { MissedPath.count }, 1 do
          post "/api/v1/missed_paths", params: { path: "/totally-gone/" }
        end
        assert_response :created
        assert_equal 1, MissedPath.find_by(path: "/totally-gone/").hits
      end
    end
  end
end
