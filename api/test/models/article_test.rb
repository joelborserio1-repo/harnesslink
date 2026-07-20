# frozen_string_literal: true

require "test_helper"

class ArticleTest < ActiveSupport::TestCase
  test "fixtures are valid" do
    assert articles(:lead).valid?
    assert articles(:new_draft).valid?
  end

  test "slug must be unique" do
    dup = Article.new(title: "Dup", slug: articles(:lead).slug,
                      body_format: :legacy_html, body_html: "<p>x</p>")
    assert_not dup.valid?
    assert_includes dup.errors[:slug], "has already been taken"
  end

  test "slug must be a single path segment" do
    a = Article.new(title: "X", slug: "has/slash", body_format: :legacy_html, body_html: "<p>x</p>")
    assert_not a.valid?
    assert_includes a.errors[:slug], "must be a single URL path segment"
  end

  test "legacy_html article requires body_html" do
    a = Article.new(title: "X", slug: "no-html", body_format: :legacy_html)
    assert_not a.valid?
    assert_includes a.errors[:body_html], "can't be blank for a legacy_html article"
  end

  test "tiptap article requires body_json" do
    a = Article.new(title: "X", slug: "no-json", body_format: :tiptap_json, body_json: {})
    assert_not a.valid?
    assert_includes a.errors[:body_json], "can't be blank for a tiptap_json article"
  end

  test "legacy_wp_id is unique but nil is allowed" do
    a = Article.create!(title: "Native", slug: "native-one", body_format: :tiptap_json,
                        body_json: { type: "doc" })
    b = Article.new(title: "Native 2", slug: "native-two", body_format: :tiptap_json,
                    body_json: { type: "doc" })
    assert b.valid?, "a second nil legacy_wp_id should be allowed"

    dup = Article.new(title: "Clash", slug: "clash", body_format: :tiptap_json,
                      body_json: { type: "doc" }, legacy_wp_id: articles(:lead).legacy_wp_id)
    assert_not dup.valid?
    assert a.persisted?
  end

  test "associations resolve categories, tags and authors" do
    lead = articles(:lead)
    assert_includes lead.categories, categories(:usa)
    assert_includes lead.tags, tags(:the_meadowlands)
    assert_includes lead.authors, authors(:adam)
    assert_equal categories(:usa), lead.primary_category
    assert_equal media_assets(:hero), lead.featured_media
  end

  test "primary_author is the lowest position byline" do
    assert_equal authors(:adam), articles(:lead).primary_author
  end

  test "live scope returns published articles up to now" do
    assert_includes Article.live, articles(:lead)
    assert_not_includes Article.live, articles(:new_draft)
  end
end
