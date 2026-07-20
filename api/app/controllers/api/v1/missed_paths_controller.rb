# frozen_string_literal: true

module Api
  module V1
    class MissedPathsController < ApplicationController
      # POST /api/v1/missed_paths  { path:, referer? }
      # Called by the Next.js 404 page to log a genuine miss.
      def create
        path = params[:path].to_s
        return head :bad_request if path.blank?

        record = MissedPath.record!(path, referer: params[:referer])
        render json: { logged: true, hits: record.hits }, status: :created
      end
    end
  end
end
