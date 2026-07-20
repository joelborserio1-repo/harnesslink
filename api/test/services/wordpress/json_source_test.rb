# frozen_string_literal: true

require "test_helper"
require "tempfile"

module Wordpress
  class JsonSourceTest < ActiveSupport::TestCase
    test "imports posts from an exported JSON file" do
      json = [
        {
          id: 9001, post_name: "json-race", post_title: "JSON Race",
          post_content: "<p>From an export.</p>", post_excerpt: "",
          post_date: "2026-07-18 11:00:00", post_modified: "2026-07-18 11:00:00",
          post_status: "publish", post_type: "post",
          meta: { "rank_math_title" => "%title% %sep% %sitename%" },
          categories: [{ name: "USA", slug: "usa", legacy_term_id: 3, kind: "geographic" }],
          tags: [{ name: "Yonkers", slug: "yonkers", legacy_term_id: 901 }],
          authors: [{ name: "Ken Weingartner", slug: "ken-weingartner", refs: { wp_user_id: 24 } }],
          old_slugs: ["json-race-old"]
        }
      ].to_json

      file = Tempfile.new(["posts", ".json"])
      file.write(json)
      file.close

      run = Importer.new(source: JsonSource.new(path: file.path)).call

      article = Article.find_by(legacy_wp_id: 9001)
      assert_not_nil article
      assert_equal "JSON Race | Harnesslink", article.seo_title
      assert_equal "USA", article.primary_category.name
      assert_equal "Ken Weingartner", article.authors.first.name
      assert_not_nil Redirect.find_by(from_path: "/json-race-old/")
      assert_equal 1, run.stats["articles_imported"]
    ensure
      file&.unlink
    end
  end
end
