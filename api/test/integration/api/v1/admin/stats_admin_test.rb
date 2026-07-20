# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Admin
      class StatsAdminTest < ActionDispatch::IntegrationTest
        setup do
          @prev = [ENV["ADMIN_USER"], ENV["ADMIN_PASSWORD"]]
          ENV["ADMIN_USER"] = "admin"
          ENV["ADMIN_PASSWORD"] = "secret"
        end
        teardown { ENV["ADMIN_USER"], ENV["ADMIN_PASSWORD"] = @prev }

        def auth
          { "Authorization" => ActionController::HttpAuthentication::Basic.encode_credentials("admin", "secret") }
        end

        test "requires auth" do
          get "/api/v1/admin/stats"
          assert_response :unauthorized
        end

        test "returns the dashboard counts" do
          get "/api/v1/admin/stats", headers: auth
          assert_response :success
          body = JSON.parse(response.body)
          %w[published drafts needs_review total_views subscribers listings active_ads].each do |k|
            assert body.key?(k), "stats should include #{k}"
          end
          assert body["published"].positive?
        end
      end
    end
  end
end
