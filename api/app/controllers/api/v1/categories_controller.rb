# frozen_string_literal: true

module Api
  module V1
    class CategoriesController < ApplicationController
      # GET /api/v1/categories
      def index
        categories = Category.ordered
        render json: { categories: categories.map { |c| serialize(c) } }
      end

      # GET /api/v1/categories/:slug — a category archive
      def show
        category = Category.find_by(slug: params[:slug])
        return head :not_found unless category

        articles = category.articles.live
                           .includes(:primary_category, :categories, :featured_media, article_authors: :author)
                           .recent_first.limit(24)

        render json: {
          category: serialize(category),
          articles: articles.map { |a| ArticleSerializer.summary(a) }
        }
      end

      private

      def serialize(category)
        { name: category.name, slug: category.slug, kind: category.kind,
          url: "/category/#{category.slug}/" }
      end
    end
  end
end
