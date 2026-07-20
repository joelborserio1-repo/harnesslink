# frozen_string_literal: true

module Api
  module V1
    module Admin
      class AuthorsController < BaseController
        # GET /api/v1/admin/authors
        def index
          authors = Author.left_joins(:articles)
                          .select("authors.*, COUNT(article_authors.id) AS articles_count")
                          .group("authors.id")
                          .order("articles_count DESC")
          render json: { authors: authors.map { |a| serialize(a) } }
        end

        # PATCH /api/v1/admin/authors/:id  (edit, or merge via merged_into_id)
        def update
          author = Author.find(params[:id])
          author.assign_attributes(author_params)
          if author.save
            render json: { author: serialize(author) }
          else
            render json: { errors: author.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def author_params
          params.require(:author).permit(:name, :slug, :bio, :email, :avatar_url,
                                         :twitter, :role_title, :position, :merged_into_id)
        end

        def serialize(author)
          {
            id: author.id, name: author.name, slug: author.slug, bio: author.bio,
            email: author.email, twitter: author.twitter, role_title: author.role_title,
            merged_into_id: author.merged_into_id,
            articles_count: author.respond_to?(:articles_count) ? author.articles_count.to_i : author.articles.count,
            legacy_refs: author.legacy_refs
          }
        end
      end
    end
  end
end
