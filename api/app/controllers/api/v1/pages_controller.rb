# frozen_string_literal: true

module Api
  module V1
    class PagesController < ApplicationController
      # GET /api/v1/pages/*path — a static page by its URL path.
      def show
        page = Page.live.find_by(path: params[:path].to_s.delete_prefix("/").delete_suffix("/"))
        return head :not_found unless page

        render json: {
          page: {
            path: page.path,
            url: page.url,
            title: page.title,
            body_html: page.body_html,
            modified_at: (page.legacy_modified_at || page.updated_at)&.iso8601,
            seo: {
              title: page.seo_title.presence || "#{page.title} - Harnesslink",
              description: page.seo_description,
              canonical_url: page.canonical_url.presence || "https://harnesslink.com#{page.url}",
              robots: page.robots.presence || "index,follow"
            }
          }
        }
      end
    end
  end
end
