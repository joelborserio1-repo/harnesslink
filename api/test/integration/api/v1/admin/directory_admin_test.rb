# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Admin
      class DirectoryAdminTest < ActionDispatch::IntegrationTest
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
          get "/api/v1/admin/directory_listings"
          assert_response :unauthorized
        end

        test "lists and filters listings" do
          get "/api/v1/admin/directory_listings", params: { type: "stallion" }, headers: auth
          assert_response :success
          names = JSON.parse(response.body)["listings"].map { |l| l["name"] }
          assert_includes names, "Bettor's Delight"
          assert_not_includes names, "All Stars Stables", "type filter should exclude trainers"
        end

        test "creates a listing" do
          assert_difference "DirectoryListing.count", 1 do
            post "/api/v1/admin/directory_listings", headers: auth,
                 params: { listing: { directory_type: "trainer", name: "New Stable", country: "Australia" } }
          end
          assert_response :created
          assert_equal "new-stable", JSON.parse(response.body).dig("listing", "slug")
        end

        test "updates and deletes a listing" do
          l = directory_listings(:sweet_lou)
          patch "/api/v1/admin/directory_listings/#{l.id}", headers: auth,
                params: { listing: { is_paying: true, service_fee: "US$9,000" } }
          assert_response :success
          assert l.reload.is_paying

          assert_difference "DirectoryListing.count", -1 do
            delete "/api/v1/admin/directory_listings/#{l.id}", headers: auth
          end
          assert_response :no_content
        end

        test "imports listings from CSV (upsert, skip blank names)" do
          csv = "name,stud,country,type,is_paying,email\n" \
                "King Of Swing,Alabar,Australia,Pacer,yes,swing@example.com\n" \
                ",,,,,\n" \
                "Free Guy,,New Zealand,Trotter,no,\n"
          tmp = Tempfile.new(["stallions", ".csv"])
          tmp.write(csv)
          tmp.rewind
          file = Rack::Test::UploadedFile.new(tmp.path, "text/csv")
          post "/api/v1/admin/directory_listings/import", headers: auth,
               params: { file: file, type: "stallion" }
          assert_response :success
          body = JSON.parse(response.body)
          assert_equal 2, body["created"]
          assert_equal 1, body["skipped"]
          king = DirectoryListing.find_by(slug: "king-of-swing")
          assert king.is_paying
          assert_equal "Trotter", DirectoryListing.find_by(slug: "free-guy").gait
        end
      end
    end
  end
end
