# frozen_string_literal: true

module Api
  module V1
    class TagsController < ApplicationController
      # GET /api/v1/tags/:slug — a tag archive (WP: /tag/{slug}/)
      def show
        tag = Tag.find_by(slug: params[:slug])
        return head :not_found unless tag

        articles = tag.articles.live
                      .includes(:primary_category, :categories, :featured_media, article_authors: :author)
                      .recent_first.limit(24)

        render json: {
          tag: { name: tag.name, slug: tag.slug, url: "/tag/#{tag.slug}/" },
          articles: articles.map { |a| ArticleSerializer.summary(a) }
        }
      end
    end
  end
end
