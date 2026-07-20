# frozen_string_literal: true

module Wordpress
  # Maps one WordPress post record (already assembled by a Source) to the
  # attributes + associations our Article model needs. Pure/testable: no DB, no
  # network. Legacy body is preserved as sanitised HTML (body_format: legacy_html).
  class ArticleMapper
    Mapped = Struct.new(:attributes, :categories, :tags, :authors, :old_slugs, :flags, keyword_init: true)

    # Conservative allowlist for legacy article HTML. Keeps structure + embeds,
    # drops anything scriptable.
    ALLOWED_TAGS = %w[
      p br a strong b em i u s sub sup blockquote q
      h2 h3 h4 h5 ul ol li dl dt dd
      img figure figcaption picture source
      table thead tbody tfoot tr th td caption
      iframe span div hr pre code
    ].freeze
    ALLOWED_ATTRS = %w[
      href src srcset sizes alt title width height
      colspan rowspan target rel loading
      allow allowfullscreen frameborder class
    ].freeze

    def initialize(post, media_rewrite: nil, site_name: "Harnesslink")
      @post = post
      @meta = post[:meta] || {}
      @media_rewrite = media_rewrite # [from_base, to_base] or nil
      @site_name = site_name
    end

    def call
      flags = []
      body, body_flags = clean_body
      flags.concat(body_flags)

      Mapped.new(
        attributes: {
          legacy_wp_id: @post[:id],
          legacy_url: "/#{@post[:post_name]}/",
          legacy_source: "wordpress",
          slug: @post[:post_name],
          title: @post[:post_title].to_s,
          subtitle: @meta["post_subtitle"].presence,
          excerpt: @post[:post_excerpt].presence,
          body_format: :legacy_html,
          body_html: body,
          status: map_status(@post[:post_status]),
          published_at: @post[:post_date],
          legacy_modified_at: @post[:post_modified],
          needs_review: flags.any?,
          import_flags: flags
        }.merge(seo_attributes),
        categories: (@post[:categories] || []),
        tags: (@post[:tags] || []),
        authors: (@post[:authors] || []),
        old_slugs: (@post[:old_slugs] || []),
        flags: flags
      )
    end

    private

    def map_status(wp_status)
      case wp_status
      when "publish" then :published
      when "draft", "auto-draft" then :draft
      when "pending" then :in_review
      when "future" then :scheduled
      else :archived
      end
    end

    def clean_body
      raw = @post[:post_content].to_s
      flags = []
      flags << "empty_body" if raw.strip.empty?
      # Shortcodes / page-builder markup won't render as plain HTML.
      flags << "shortcodes" if raw.match?(/\[[a-z][a-z0-9_]*[\s\]]/i)
      flags << "elementor" if @meta.key?("_elementor_data")

      html = rewrite_media(raw)
      html = sanitize(html)
      [html, flags]
    end

    def rewrite_media(html)
      return html unless @media_rewrite
      from, to = @media_rewrite
      html.gsub(from, to)
    end

    def sanitize(html)
      # Drop script/style blocks WITH their contents first — the tag sanitizer
      # alone would strip the tags but leave their text behind.
      stripped = html.gsub(%r{<script\b[^>]*>.*?</script>}mi, "")
                     .gsub(%r{<style\b[^>]*>.*?</style>}mi, "")
      Rails::HTML::SafeListSanitizer.new.sanitize(
        stripped, tags: ALLOWED_TAGS, attributes: ALLOWED_ATTRS
      ).to_s
    end

    def seo_attributes
      {
        seo_title: expand_vars(@meta["rank_math_title"]),
        seo_description: expand_vars(@meta["rank_math_description"]),
        focus_keyword: @meta["rank_math_focus_keyword"].presence,
        canonical_url: @meta["rank_math_canonical_url"].presence,
        robots: parse_robots(@meta["rank_math_robots"]),
        og_title: expand_vars(@meta["rank_math_facebook_title"]),
        og_description: expand_vars(@meta["rank_math_facebook_description"]),
        twitter_title: expand_vars(@meta["rank_math_twitter_title"]),
        twitter_description: expand_vars(@meta["rank_math_twitter_description"])
      }.compact
    end

    # Expand the common Rank Math template variables. Posts with NO explicit
    # title fall back (elsewhere) to the site-wide Rank Math title format.
    def expand_vars(value)
      return nil if value.blank?
      primary = (@post[:categories] || []).first
      value.to_s
           .gsub("%title%", @post[:post_title].to_s)
           .gsub("%sitename%", @site_name)
           .gsub("%sep%", "|")
           .gsub("%page%", "")
           .gsub(/%category%|%primary_category%/, primary ? primary[:name].to_s : "")
           .gsub("%currentyear%", (@post[:post_date]&.year || Time.current.year).to_s)
           .gsub(/\s{2,}/, " ").strip.presence
    end

    # Rank Math stores robots as a serialized PHP array, e.g.
    #   a:2:{i:0;s:5:"index";i:1;s:6:"follow";}
    def parse_robots(value)
      return nil if value.blank?
      tokens = value.to_s.scan(/s:\d+:"([^"]+)"/).flatten
      tokens = value.to_s.split(",") if tokens.empty?
      tokens.map(&:strip).reject(&:empty?).uniq.join(",").presence
    end
  end
end
