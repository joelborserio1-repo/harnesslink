# frozen_string_literal: true

module Wordpress
  # Orchestrates the load: iterate a Source, map each post, upsert authors /
  # categories / tags / the article, and generate old-slug redirects.
  #
  # - Idempotent: keyed on legacy_wp_id / slugs, so re-running never duplicates.
  # - Resumable: checkpoints the highest processed wp id on an ImportRun.
  # - Fault-tolerant: a bad post is logged and counted, not fatal to the run.
  # - Additive: never deletes.
  class Importer
    CHECKPOINT_EVERY = 25

    def initialize(source:, run: nil, media_rewrite: nil, logger: Rails.logger)
      @source = source
      @run = run || ImportRun.start!
      @media_rewrite = media_rewrite
      @logger = logger
    end

    def call
      seen = 0
      @source.each_post(after_id: @run.cursor_legacy_id) do |post|
        @run.bump("posts_seen")
        begin
          import_post(post)
        rescue StandardError => e
          @run.bump("errors")
          @logger.error("[import] post #{post[:id]} failed: #{e.class}: #{e.message}")
        end
        @run.cursor_legacy_id = post[:id].to_i if post[:id].to_i > @run.cursor_legacy_id.to_i
        seen += 1
        @run.save! if (seen % CHECKPOINT_EVERY).zero?
      end
      @run.finish!
      @run
    rescue StandardError => e
      @run.finish!(error: "#{e.class}: #{e.message}")
      raise
    end

    private

    def import_post(post)
      mapped = ArticleMapper.new(post, media_rewrite: @media_rewrite).call

      article = Article.find_or_initialize_by(legacy_wp_id: post[:id])
      was_new = article.new_record?
      article.assign_attributes(mapped.attributes)

      categories = mapped.categories.map { |c| upsert_category(c) }
      article.primary_category = categories.first if categories.first
      article.save!

      @run.bump("articles_imported") if was_new
      @run.bump("flagged") if mapped.flags.any?

      categories.each { |cat| ArticleCategory.find_or_create_by!(article: article, category: cat) }
      sync_tags(article, mapped.tags)
      sync_authors(article, mapped.authors)
      create_redirects(article, mapped.old_slugs)
    end

    def upsert_category(descriptor)
      category = Category.find_or_initialize_by(slug: descriptor[:slug])
      if category.new_record?
        category.assign_attributes(
          name: descriptor[:name],
          legacy_term_id: descriptor[:legacy_term_id],
          kind: descriptor[:kind] || :geographic
        )
        category.save!
        @run.bump("categories")
      end
      category
    end

    def sync_tags(article, tags)
      tags.each do |descriptor|
        tag = Tag.find_or_initialize_by(slug: descriptor[:slug])
        if tag.new_record?
          tag.assign_attributes(name: descriptor[:name], legacy_term_id: descriptor[:legacy_term_id])
          tag.save!
          @run.bump("tags")
        end
        ArticleTag.find_or_create_by!(article: article, tag: tag)
      end
    end

    def sync_authors(article, authors)
      authors.each_with_index do |descriptor, position|
        author = Author.find_or_initialize_by(slug: descriptor[:slug])
        if author.new_record?
          author.assign_attributes(name: descriptor[:name], legacy_refs: descriptor[:refs] || {})
          author.save!
          @run.bump("authors")
        end
        link = ArticleAuthor.find_or_initialize_by(article: article, author: author)
        link.position = position
        link.save!
      end
    end

    def create_redirects(article, old_slugs)
      old_slugs.each do |old_slug|
        from = "/#{old_slug}/"
        next if from == article.legacy_url

        redirect = Redirect.find_or_initialize_by(from_path: from)
        next unless redirect.new_record?

        redirect.assign_attributes(to_path: article.legacy_url, status_code: 301, reason: "wp_old_slug")
        redirect.save!
        @run.bump("redirects")
      end
    end
  end
end
