# frozen_string_literal: true

module Wordpress
  # Loads static WordPress pages (export_posts.php with EXPORT_TYPES=page) into
  # Page. Same rules as the article importer: idempotent on legacy_wp_id,
  # additive, body sanitised but otherwise verbatim.
  #
  # Only pages named in `only` are imported. Of the ~76 pages on the live site
  # most are either features we rebuild natively (directory, race calendars,
  # The Eureka, login/register) or test pages; importing those as static HTML
  # would shadow nothing useful and publish junk.
  class PageImporter
    # /contributors/ (an Elementor grid of writers) and /advertise-with-us/ (a
    # form shortcode) are not here: they need native templates, not their markup.
    CONTENT_PAGES = %w[privacy-policy disclaimers terms-conditions a-pilgrimage-to-france].freeze

    Result = Struct.new(:imported, :skipped, :errors, keyword_init: true)

    def initialize(source:, only: CONTENT_PAGES, logger: Rails.logger)
      @source = source
      @only = only
      @logger = logger
    end

    def call
      result = Result.new(imported: 0, skipped: [], errors: 0)
      @source.each_post do |post|
        path = (post[:path].presence || post[:post_name]).to_s.delete_prefix("/").delete_suffix("/")
        unless post[:post_type] == "page" && @only.include?(path)
          result.skipped << path
          next
        end

        begin
          import_page(post, path)
          result.imported += 1
        rescue StandardError => e
          result.errors += 1
          @logger.error("[import] page #{post[:id]} (#{path}) failed: #{e.class}: #{e.message}")
        end
      end
      result
    end

    private

    def import_page(post, path)
      mapped = ArticleMapper.new(post).call.attributes
      page = Page.find_or_initialize_by(legacy_wp_id: post[:id])
      page.assign_attributes(
        path: path,
        title: mapped[:title],
        body_html: mapped[:body_html],
        status: mapped[:status] == :published ? :published : :draft,
        # Rank Math's page title format on the live site is "%title% - %sitename%".
        seo_title: mapped[:seo_title],
        seo_description: mapped[:seo_description],
        canonical_url: mapped[:canonical_url],
        robots: mapped[:robots],
        legacy_url: "/#{path}/",
        published_at: mapped[:published_at],
        legacy_modified_at: mapped[:legacy_modified_at]
      )
      page.save!
    end
  end
end
