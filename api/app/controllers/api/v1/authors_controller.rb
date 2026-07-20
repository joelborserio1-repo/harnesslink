# frozen_string_literal: true

module Api
  module V1
    class AuthorsController < ApplicationController
      # GET /api/v1/authors/:slug — an author archive (WP: /author/{slug}/)
      def show
        author = Author.find_by(slug: params[:slug])
        return head :not_found unless author

        # A merged duplicate points at its canonical author's archive.
        if author.merged_into
          return render json: { redirect_to: "/author/#{author.merged_into.slug}/" }
        end

        # Include the canonical author's articles plus any merged aliases'.
        author_ids = [author.id, *author.aliases.pluck(:id)]
        articles = Article.live
                          .joins(:article_authors).where(article_authors: { author_id: author_ids })
                          .includes(:primary_category, :categories, :featured_media, article_authors: :author)
                          .distinct.recent_first.limit(24)

        render json: {
          author: { name: author.name, slug: author.slug, bio: author.bio,
                    role_title: author.role_title, url: "/author/#{author.slug}/" },
          articles: articles.map { |a| ArticleSerializer.summary(a) }
        }
      end
    end
  end
end
