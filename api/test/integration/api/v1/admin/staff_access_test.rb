# frozen_string_literal: true

require "test_helper"

module Api
  module V1
    module Admin
      # Per-person staff sign-in and what each role may do.
      class StaffAccessTest < ActionDispatch::IntegrationTest
        PASSWORD = "correct-horse-battery"

        def create_article(user, attrs = {})
          post "/api/v1/admin/articles", headers: staff_headers(user), params: {
            article: { title: "Filed from trackside", slug: "filed-from-trackside-#{SecureRandom.hex(3)}",
                       body_format: "legacy_html", body_html: "<p>Copy.</p>", status: "draft" }.merge(attrs)
          }
          JSON.parse(response.body)["article"]
        end

        # ---- sign-in ----

        test "signs in with email and password and returns a working token" do
          post "/api/v1/admin/session", params: { email: "Journo@Harnesslink.com ", password: PASSWORD }
          assert_response :success
          body = JSON.parse(response.body)
          assert_equal "contributor", body.dig("user", "role")

          get "/api/v1/admin/session", headers: { "Authorization" => "Bearer #{body['token']}" }
          assert_response :success
          assert_equal "journo@harnesslink.com", JSON.parse(response.body).dig("user", "email")
        end

        test "rejects a wrong password, a reader account and a deactivated account alike" do
          post "/api/v1/admin/session", params: { email: users(:editor).email, password: "wrong-password" }
          assert_response :unauthorized

          post "/api/v1/admin/session", params: { email: users(:reader).email, password: PASSWORD }
          assert_response :unauthorized

          users(:editor).update!(active: false)
          post "/api/v1/admin/session", params: { email: users(:editor).email, password: PASSWORD }
          assert_response :unauthorized
        end

        test "a token stops working when the account is deactivated or its password changes" do
          headers = staff_headers(users(:editor))
          get "/api/v1/admin/articles", headers: headers
          assert_response :success

          users(:editor).update!(password: "a-brand-new-password")
          get "/api/v1/admin/articles", headers: headers
          assert_response :unauthorized

          headers = staff_headers(users(:contributor))
          users(:contributor).update!(active: false)
          get "/api/v1/admin/articles", headers: headers
          assert_response :unauthorized
        end

        # ---- contributor ----

        test "a contributor sees only their own stories" do
          mine = create_article(users(:contributor))
          assert_response :created

          get "/api/v1/admin/articles", headers: staff_headers(users(:contributor))
          slugs = JSON.parse(response.body)["articles"].map { |a| a["slug"] }
          assert_equal [ mine["slug"] ], slugs

          get "/api/v1/admin/articles/#{articles(:lead).id}", headers: staff_headers(users(:contributor))
          assert_response :not_found
        end

        test "a contributor can submit for review but cannot publish" do
          article = create_article(users(:contributor), status: "published")
          assert_equal "draft", article["status"], "publish request from a contributor is ignored"

          patch "/api/v1/admin/articles/#{article['id']}", headers: staff_headers(users(:contributor)),
                                                           params: { article: { status: "in_review" } }
          assert_response :success
          assert_equal "in_review", JSON.parse(response.body).dig("article", "status")

          patch "/api/v1/admin/articles/#{article['id']}", headers: staff_headers(users(:contributor)),
                                                           params: { article: { status: "published" } }
          assert_equal "in_review", Article.find(article["id"]).status
        end

        test "a contributor cannot edit their story once the desk has published it" do
          article = create_article(users(:contributor))
          patch "/api/v1/admin/articles/#{article['id']}", headers: staff_headers(users(:editor)),
                                                           params: { article: { status: "published" } }
          assert_response :success
          published = Article.find(article["id"])
          assert published.status_published?
          assert_not_nil published.published_at, "publishing stamps the publish time"

          patch "/api/v1/admin/articles/#{article['id']}", headers: staff_headers(users(:contributor)),
                                                           params: { article: { title: "Sneaky edit" } }
          assert_response :forbidden
        end

        test "a contributor's story carries their linked byline" do
          users(:contributor).update!(author: authors(:adam))
          article = create_article(users(:contributor))
          assert_equal [ "Adam Hamilton" ], article["authors"]
          assert_equal "A Journalist", article["created_by"]
        end

        test "contributors cannot reach ads, the directory admin or user management" do
          headers = staff_headers(users(:contributor))
          get "/api/v1/admin/ads", headers: headers
          assert_response :forbidden
          get "/api/v1/admin/directory_listings", headers: headers
          assert_response :forbidden
          get "/api/v1/admin/users", headers: headers
          assert_response :forbidden
        end

        # ---- editor ----

        test "an editor edits anyone's story, and the previous version is kept" do
          lead = articles(:lead)
          assert_difference -> { lead.article_revisions.count }, 1 do
            patch "/api/v1/admin/articles/#{lead.id}", headers: staff_headers(users(:editor)),
                                                       params: { article: { title: "Sharper headline" } }
          end
          assert_response :success
          revision = lead.article_revisions.last
          assert_equal "Lexus Kody wins the $300,000 G2 Spirit of Massachusetts Trot", revision.title
          assert_equal users(:editor), revision.editor
        end

        test "editors manage the directory but not ads or users" do
          headers = staff_headers(users(:editor))
          get "/api/v1/admin/directory_listings", headers: headers
          assert_response :success
          get "/api/v1/admin/ads", headers: headers
          assert_response :forbidden
          get "/api/v1/admin/users", headers: headers
          assert_response :forbidden
        end

        # ---- admin: user management ----

        test "an admin creates, re-roles and deactivates staff accounts" do
          post "/api/v1/admin/users", headers: staff_headers, params: {
            user: { email: "new.writer@harnesslink.com", name: "New Writer", role: "contributor", password: "a-long-first-password" }
          }
          assert_response :created
          id = JSON.parse(response.body).dig("user", "id")

          post "/api/v1/admin/session", params: { email: "new.writer@harnesslink.com", password: "a-long-first-password" }
          assert_response :success

          patch "/api/v1/admin/users/#{id}", headers: staff_headers, params: { user: { role: "editor", active: false } }
          assert_response :success
          user = User.find(id)
          assert user.role_editor?
          assert_not user.active?
        end

        test "an admin cannot lock themselves out, and short passwords are refused" do
          patch "/api/v1/admin/users/#{users(:admin).id}", headers: staff_headers, params: { user: { active: false } }
          assert_response :unprocessable_entity
          assert users(:admin).reload.active?

          post "/api/v1/admin/users", headers: staff_headers, params: {
            user: { email: "short@harnesslink.com", name: "Short", role: "editor", password: "short" }
          }
          assert_response :unprocessable_entity
        end

        test "the user list never includes readers" do
          get "/api/v1/admin/users", headers: staff_headers
          emails = JSON.parse(response.body)["users"].map { |u| u["email"] }
          assert_includes emails, users(:editor).email
          assert_not_includes emails, users(:reader).email
        end
      end
    end
  end
end
