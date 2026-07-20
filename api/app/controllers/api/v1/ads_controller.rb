# frozen_string_literal: true

module Api
  module V1
    # Public ad delivery. One live ad per zone (weighted), plus a click
    # tracker that counts and redirects to the creative's target.
    class AdsController < ApplicationController
      # GET /api/v1/ads — { ads: { zone => creative } } for every filled zone.
      def index
        ads = Ad.live_by_zone.transform_values { |ad| creative(ad) }
        render json: { ads: ads }
      end

      # GET /api/v1/ads/:id/click — count the click and 302 to the target.
      def click
        ad = Ad.find_by(id: params[:id])
        Ad.where(id: ad.id).update_all("clicks = clicks + 1") if ad
        target = ad&.link_url.presence || "/"
        redirect_to target, allow_other_host: true, status: :found
      end

      private

      def creative(ad)
        {
          id: ad.id,
          zone: ad.zone,
          size: ad.size,
          image_url: ad.image_url.presence,
          html: ad.html.presence,
          alt: ad.alt.presence || ad.name,
          click_url: "/ad/#{ad.id}/click"
        }
      end
    end
  end
end
