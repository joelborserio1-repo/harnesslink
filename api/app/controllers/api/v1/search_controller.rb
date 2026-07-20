# frozen_string_literal: true

module Api
  module V1
    # Public article search. Case-insensitive match on title/excerpt over live
    # articles, most-recent first, paginated. (A trigram/full-text index is the
    # upgrade path once real content volume lands.)
    class SearchController < ApplicationController
      PER_PAGE = 20

      def index
        q = params[:q].to_s.strip
        page = [params.fetch(:page, 1).to_i, 1].max

        if q.length < 2
          return render json: { query: q, articles: [], total: 0, page: page, per_page: PER_PAGE }
        end

        like = "%#{ActiveRecord::Base.sanitize_sql_like(q)}%"
        scope = Article.live
                       .where("title ILIKE :q OR excerpt ILIKE :q", q: like)
                       .includes(:primary_category, :categories, :featured_media, article_authors: :author)
                       .recent_first

        render json: {
          query: q,
          total: scope.count,
          page: page,
          per_page: PER_PAGE,
          articles: scope.offset((page - 1) * PER_PAGE).limit(PER_PAGE).map { |a| ArticleSerializer.summary(a) }
        }
      end
    end
  end
end
