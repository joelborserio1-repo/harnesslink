# frozen_string_literal: true

module Api
  module V1
    module Admin
      class ArticlesController < BaseController
        # GET /api/v1/admin/articles?status=&needs_review=&q=&page=
        def index
          page     = [params.fetch(:page, 1).to_i, 1].max
          per_page = [[params.fetch(:per_page, 25).to_i, 1].max, 100].min

          scope = Article.includes(:primary_category, article_authors: :author).order(created_at: :desc)
          scope = scope.where(status: Article.statuses[params[:status]]) if params[:status].present?
          scope = scope.where(needs_review: true) if params[:needs_review] == "true"
          if params[:q].present?
            scope = scope.where("title ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(params[:q])}%")
          end

          render json: {
            articles: scope.offset((page - 1) * per_page).limit(per_page).map { |a| AdminArticleSerializer.summary(a) },
            page: page, per_page: per_page, total: scope.count
          }
        end

        # GET /api/v1/admin/articles/:id
        def show
          render json: { article: AdminArticleSerializer.full(find_article) }
        end

        # PATCH /api/v1/admin/articles/:id
        def update
          article = find_article
          article.assign_attributes(article_params)
          apply_associations(article)

          if article.save
            render json: { article: AdminArticleSerializer.full(article.reload) }
          else
            render json: { errors: article.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def find_article
          Article.find(params[:id])
        end

        def article_params
          params.require(:article).permit(
            :title, :subtitle, :slug, :excerpt, :status, :body_format, :body_html,
            :seo_title, :seo_description, :focus_keyword, :canonical_url, :robots,
            :og_title, :og_description, :twitter_title, :twitter_description,
            :schema_type, :primary_category_id, :needs_review
          )
        end

        # Rebuild byline order from author_ids; set category/tag membership.
        def apply_associations(article)
          if params[:article].key?(:author_ids)
            article.article_authors.destroy_all
            Array(params[:article][:author_ids]).each_with_index do |aid, i|
              article.article_authors.build(author_id: aid, position: i)
            end
          end
          article.category_ids = Array(params[:article][:category_ids]) if params[:article].key?(:category_ids)
          article.tag_ids = Array(params[:article][:tag_ids]) if params[:article].key?(:tag_ids)
        end
      end
    end
  end
end
