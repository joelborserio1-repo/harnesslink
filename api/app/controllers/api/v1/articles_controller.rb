# frozen_string_literal: true

module Api
  module V1
    class ArticlesController < ApplicationController
      # GET /api/v1/articles
      def index
        page     = [params.fetch(:page, 1).to_i, 1].max
        per_page = [[params.fetch(:per_page, 12).to_i, 1].max, 50].min

        scope = Article.live
                       .includes(:primary_category, :categories, :featured_media, article_authors: :author)
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
                         .includes(:primary_category, :categories, :tags, :featured_media,
                                   article_authors: :author)
                         .find_by(slug: params[:slug])
        return head :not_found unless article

        json = ArticleSerializer.full(article)
        json[:related] = related_articles(article).map { |a| ArticleSerializer.summary(a) }
        render json: { article: json }
      end

      # POST /api/v1/articles/:slug/view — increment the view counter (fired by a
      # browser beacon, so bots/SSR prefetch don't inflate it). Atomic, no body.
      def view
        Article.where(slug: params[:slug]).update_all("view_count = view_count + 1")
        head :no_content
      end

      private

      # "More from {region}" — recent live stories in the same primary category
      # (falls back to site-wide recent), excluding the article itself. Internal
      # linking + engagement on a template that otherwise dead-ends.
      def related_articles(article)
        scope = Article.live.where.not(id: article.id)
                       .includes(:primary_category, :featured_media, article_authors: :author)
                       .recent_first.limit(6)
        if article.primary_category_id
          scope.where(primary_category_id: article.primary_category_id)
        else
          scope
        end
      end
    end
  end
end
