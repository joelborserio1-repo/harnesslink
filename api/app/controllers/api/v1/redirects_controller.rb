# frozen_string_literal: true

module Api
  module V1
    class RedirectsController < ApplicationController
      # GET /api/v1/redirects/resolve?path=/old-slug/
      # Used by the Next.js edge middleware. Always 200; the `redirect` flag
      # says whether to redirect (a "no redirect" is NOT a 404 — the path may
      # be a valid article).
      def resolve
        redirect = Redirect.resolve(params[:path])
        if redirect
          redirect.record_hit!
          render json: { redirect: true, status: redirect.status_code, location: redirect.to_path }
        else
          render json: { redirect: false }
        end
      end
    end
  end
end
