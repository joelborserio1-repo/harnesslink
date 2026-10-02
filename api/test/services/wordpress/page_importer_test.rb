# frozen_string_literal: true

require "test_helper"

module Wordpress
  class PageImporterTest < ActiveSupport::TestCase
    class ListSource
      def initialize(posts) = @posts = posts
      def each_post(after_id: 0) = @posts.each { |p| yield p }
    end

    def page(id, name, overrides = {})
      { id: id, post_name: name, path: "/#{name}/", post_title: name.titleize, post_type: "page",
        post_status: "publish", post_content: "<p>Body of #{name}.</p><script>alert(1)</script>",
        post_date: Time.utc(2024, 1, 1), post_modified: Time.utc(2025, 6, 1), meta: {} }.merge(overrides)
    end

    test "imports only the named content pages, sanitised, and is idempotent" do
      source = ListSource.new([ page(10, "privacy-policy"), page(11, "ztest-page"), page(12, "directory") ])

      2.times { PageImporter.new(source: source).call }

      assert_equal [ "privacy-policy" ], Page.pluck(:path)
      imported = Page.find_by!(path: "privacy-policy")
      assert_equal "<p>Body of privacy-policy.</p>", imported.body_html
      assert_equal "/privacy-policy/", imported.legacy_url
      assert_equal 10, imported.legacy_wp_id
      assert imported.status_published?
    end

    test "reports what it skipped and keeps child paths" do
      source = ListSource.new([ page(20, "editions", path: "/the-insider/editions/"), page(21, "api-testing") ])
      result = PageImporter.new(source: source, only: [ "the-insider/editions" ]).call

      assert_equal 1, result.imported
      assert_equal [ "api-testing" ], result.skipped
      assert_equal "/the-insider/editions/", Page.find_by!(legacy_wp_id: 20).url
    end

    test "a post is never imported as a page" do
      source = ListSource.new([ page(30, "privacy-policy", post_type: "post") ])
      assert_no_difference "Page.count" do
        PageImporter.new(source: source).call
      end
    end
  end
end
