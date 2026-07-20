# frozen_string_literal: true

require "test_helper"

module Wordpress
  class ArticleMapperTest < ActiveSupport::TestCase
    def post(overrides = {})
      {
        id: 2387693,
        post_name: "lexus-kody-wins",
        post_title: "Lexus Kody wins",
        post_content: "<p>Great race.</p><script>alert(1)</script><p>More.</p>",
        post_excerpt: "",
        post_date: Time.zone.parse("2026-07-18 11:00:00"),
        post_modified: Time.zone.parse("2026-07-19 09:00:00"),
        post_status: "publish",
        post_type: "post",
        meta: {},
        categories: [{ name: "USA", slug: "usa", legacy_term_id: 3, kind: :geographic }],
        tags: [], authors: [], old_slugs: []
      }.merge(overrides)
    end

    test "preserves legacy HTML but strips scripts" do
      m = ArticleMapper.new(post).call
      assert_equal "legacy_html", m.attributes[:body_format].to_s
      assert_includes m.attributes[:body_html], "<p>Great race.</p>"
      assert_not_includes m.attributes[:body_html], "<script>"
      assert_not_includes m.attributes[:body_html], "alert(1)"
    end

    test "maps Rank Math meta into SEO fields with variable expansion" do
      m = ArticleMapper.new(post(meta: {
        "rank_math_title" => "%title% %sep% %sitename%",
        "rank_math_description" => "Report on the race.",
        "rank_math_focus_keyword" => "lexus kody",
        "rank_math_canonical_url" => "https://harnesslink.com/lexus-kody-wins/",
        "rank_math_robots" => 'a:2:{i:0;s:5:"index";i:1;s:6:"follow";}'
      })).call

      assert_equal "Lexus Kody wins | Harnesslink", m.attributes[:seo_title]
      assert_equal "Report on the race.", m.attributes[:seo_description]
      assert_equal "lexus kody", m.attributes[:focus_keyword]
      assert_equal "index,follow", m.attributes[:robots]
    end

    test "flags shortcode and empty bodies for review" do
      shortcode = ArticleMapper.new(post(post_content: "[vc_row]stuff[/vc_row]")).call
      assert shortcode.attributes[:needs_review]
      assert_includes shortcode.flags, "shortcodes"

      empty = ArticleMapper.new(post(post_content: "   ")).call
      assert empty.attributes[:needs_review]
      assert_includes empty.flags, "empty_body"
    end

    test "rewrites media URLs when configured" do
      m = ArticleMapper.new(
        post(post_content: '<img src="https://harnesslink.com/wp-content/uploads/a.jpg">'),
        media_rewrite: ["https://harnesslink.com/wp-content/uploads", "https://cdn.example.com/media"]
      ).call
      assert_includes m.attributes[:body_html], "https://cdn.example.com/media/a.jpg"
    end

    test "maps subtitle and status" do
      m = ArticleMapper.new(post(meta: { "post_subtitle" => "A subtitle" }, post_status: "draft")).call
      assert_equal "A subtitle", m.attributes[:subtitle]
      assert_equal :draft, m.attributes[:status]
    end
  end
end
