# frozen_string_literal: true

require "test_helper"

module Wordpress
  class ImporterTest < ActiveSupport::TestCase
    def wp_post(id:, slug:, title:, **over)
      {
        id: id, post_name: slug, post_title: title,
        post_content: "<p>#{title}.</p>", post_excerpt: "",
        post_date: Time.zone.parse("2026-07-18 11:00:00"),
        post_modified: Time.zone.parse("2026-07-18 11:00:00"),
        post_status: "publish", post_type: "post", meta: {},
        categories: [{ name: "USA", slug: "usa", legacy_term_id: 3, kind: :geographic }],
        tags: [{ name: "The Meadowlands", slug: "the-meadowlands", legacy_term_id: 900 }],
        authors: [{ name: "Tim Bojarski", slug: "tim-bojarski", refs: { "wp_user_id" => 24 } }],
        old_slugs: []
      }.merge(over)
    end

    def source(posts)
      FixtureSource.new(posts: posts)
    end

    test "imports a post with its category, tag, author and provenance" do
      Importer.new(source: source([wp_post(id: 5001, slug: "race-one", title: "Race One")])).call

      article = Article.find_by(legacy_wp_id: 5001)
      assert_not_nil article
      assert_equal "race-one", article.slug
      assert_equal "/race-one/", article.legacy_url
      assert_equal "USA", article.primary_category.name
      assert_includes article.tags.map(&:slug), "the-meadowlands"
      assert_equal "Tim Bojarski", article.authors.first.name
      assert article.status_published?
    end

    test "generates 301 redirects from old slugs" do
      Importer.new(source: source([
        wp_post(id: 5002, slug: "current-slug", title: "Story", old_slugs: %w[old-one old-two])
      ])).call

      r = Redirect.find_by(from_path: "/old-one/")
      assert_not_nil r
      assert_equal "/current-slug/", r.to_path
      assert_equal 301, r.status_code
      assert_equal "wp_old_slug", r.reason
    end

    test "is idempotent — re-running does not duplicate" do
      posts = [wp_post(id: 5003, slug: "dupe", title: "Dupe")]
      Importer.new(source: source(posts)).call
      counts = [Article.count, Category.count, Tag.count, Author.count, ArticleAuthor.count]
      Importer.new(source: source(posts)).call
      assert_equal counts, [Article.count, Category.count, Tag.count, Author.count, ArticleAuthor.count]
    end

    test "flags shortcode bodies and records run stats" do
      run = Importer.new(source: source([
        wp_post(id: 5004, slug: "builder", title: "Builder", post_content: "[vc_row]x[/vc_row]")
      ])).call

      assert Article.find_by(legacy_wp_id: 5004).needs_review
      assert_equal 1, run.stats["flagged"]
      assert_equal 1, run.stats["articles_imported"]
      assert run.status_completed?
    end

    test "imports and links the featured image" do
      featured = { legacy_id: 7001, url: "https://harnesslink.com/wp-content/uploads/x.jpg",
                   width: 1200, height: 800, alt: "A pacer", mime_type: "image/jpeg" }
      run = Importer.new(source: source([
        wp_post(id: 5007, slug: "with-photo", title: "Photo", featured: featured)
      ])).call

      media = Article.find_by(legacy_wp_id: 5007).featured_media
      assert_not_nil media
      assert_equal 1200, media.width
      assert_equal "https://harnesslink.com/wp-content/uploads/x.jpg", media.legacy_url
      assert_equal 1, run.stats["media"]
      assert media.responsive[:srcset].include?("640w")
    end

    test "a legacy_term_id already taken by another row does not abort the post" do
      # The new_zealand fixture already owns term_id 2 (like a demo-seed row that
      # grabbed a low id); a different, real live category reuses it on import.
      post = wp_post(id: 5010, slug: "collide", title: "Collide",
                     categories: [{ name: "Harness Racing", slug: "harness-racing",
                                    legacy_term_id: 2, kind: :geographic }])

      run = Importer.new(source: source([post])).call

      article = Article.find_by(legacy_wp_id: 5010)
      assert_not_nil article, "post must import despite the term_id clash"
      assert_equal "harness-racing", article.primary_category.slug
      assert_nil article.primary_category.legacy_term_id, "clashing id stays with its original owner"
      assert_equal 0, run.stats["errors"].to_i
    end

    test "backfills the WordPress term_id onto a slug-matched seed category" do
      Category.create!(name: "Testland", slug: "testland", kind: :geographic) # seed row, no term_id
      post = wp_post(id: 5011, slug: "testland-story", title: "Testland Story",
                     categories: [{ name: "Testland", slug: "testland", legacy_term_id: 777, kind: :geographic }])

      Importer.new(source: source([post])).call
      assert_equal 777, Category.find_by(slug: "testland").legacy_term_id
    end

    test "resumes from the run cursor, skipping processed posts" do
      run = ImportRun.start!
      run.update!(cursor_legacy_id: 5005)
      Importer.new(
        source: source([wp_post(id: 5005, slug: "skip-me", title: "Skip"),
                        wp_post(id: 5006, slug: "do-me", title: "Do")]),
        run: run
      ).call

      assert_nil Article.find_by(legacy_wp_id: 5005), "already-processed post should be skipped"
      assert_not_nil Article.find_by(legacy_wp_id: 5006)
    end
  end
end
