# frozen_string_literal: true

module Api
  module V1
    module Admin
      # At-a-glance counts for the admin dashboard (HTTP Basic gated).
      class StatsController < BaseController
        def show
          render json: {
            published: Article.status_published.count,
            drafts: Article.status_draft.count,
            needs_review: Article.where(needs_review: true).count,
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
