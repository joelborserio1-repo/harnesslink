# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    class SubscriptionsTest < ActionDispatch::IntegrationTest
      test "subscribing captures a reader account" do
        assert_difference "User.count", 1 do
          post "/api/v1/subscribe", params: { email: "New.Reader@Example.com" }
        end
        assert_response :success
        u = User.find_by("lower(email) = ?", "new.reader@example.com")
        assert u.role_reader?
      end

      test "re-subscribing is an idempotent success" do
        post "/api/v1/subscribe", params: { email: "dupe@example.com" }
        assert_no_difference "User.count" do
          post "/api/v1/subscribe", params: { email: "dupe@example.com" }
        end
        assert_response :success
      end

      test "an invalid email is rejected" do
        post "/api/v1/subscribe", params: { email: "not-an-email" }
        assert_response :unprocessable_entity
      end
    end
  end
end
