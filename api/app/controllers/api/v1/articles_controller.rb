# frozen_string_literal: true

module Api
  module V1
    class ArticlesController < ApplicationController
      # GET /api/v1/articles
      def index
        page     = [params.fetch(:page, 1).to_i, 1].max
        per_page = [[params.fetch(:per_page, 12).to_i, 1].max, 50].min

        scope = Article.live
                       .includes(:primary_category, article_authors: :author)
                       .recent_first
        articles = scope.offset((page - 1) * per_page).limit(per_page)

        render json: {
          articles: articles.map { |a| ArticleSerializer.summary(a) },
          page: page,
          per_page: per_page,
          total: scope.count
        }
      end

      # GET /api/v1/articles/:slug
      def show
        article = Article.live
                         .includes(:primary_category, :categories, :featured_media,
                                   article_authors: :author)
                         .find_by(slug: params[:slug])
        return head :not_found unless article

        render json: { article: ArticleSerializer.full(article) }
      end
    end
  end
end
