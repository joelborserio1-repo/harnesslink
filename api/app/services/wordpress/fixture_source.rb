# frozen_string_literal: true

module Wordpress
  # A source backed by plain Ruby hashes — used in tests and to dry-run the
  # importer without a live WordPress database. Each post is a record hash:
  #   { id:, post_name:, post_title:, post_content:, post_excerpt:, post_date:,
  #     post_modified:, post_status:, post_type:, meta: {}, categories: [],
  #     tags: [], authors: [], old_slugs: [] }
  class FixtureSource
    def initialize(posts:)
      @posts = posts.sort_by { |p| p[:id].to_i }
    end

    def each_post(after_id: 0)
      @posts.each { |post| yield post if post[:id].to_i > after_id.to_i }
    end
  end
end
