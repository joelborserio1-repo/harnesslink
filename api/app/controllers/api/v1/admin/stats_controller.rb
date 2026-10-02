# frozen_string_literal: true

module Api
  module V1
    module Admin
      # At-a-glance counts for the admin dashboard (any signed-in staff).
      class StatsController < BaseController
        def show
          render json: {
            published: Article.status_published.count,
            drafts: Article.status_draft.count,
            needs_review: Article.where(needs_review: true).count,
            in_review: Article.status_in_review.count,
            my_drafts: Article.status_draft.where(created_by_id: current_user.id).count,
            total_views: Article.sum(:view_count),
            subscribers: User.role_reader.count,
            listings: DirectoryListing.count,
            active_ads: Ad.live.count
          }
        end
      end
    end
  end
end
