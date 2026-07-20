# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Ad manager (HTTP Basic gated). CRUD + the zone registry for the UI.
      class AdsController < BaseController
        def index
          render json: {
            ads: Ad.order(:zone, :name).map { |a| serialize(a) },
            zones: Ads::Zones.all
          }
        end

        def show
          render json: { ad: serialize(find_ad) }
        end

        def create
          ad = Ad.new(ad_params)
          save_and_render(ad, :created)
        end

        def update
          ad = find_ad
          ad.assign_attributes(ad_params)
          save_and_render(ad, :ok)
        end

        def destroy
          find_ad.destroy!
          head :no_content
        end

        private

        def find_ad
          Ad.find(params[:id])
        end

        def save_and_render(ad, ok_status)
          ad.size = Ads::Zones.size_for(ad.zone) if ad.size.blank?
          if ad.save
            render json: { ad: serialize(ad) }, status: ok_status
          else
            render json: { errors: ad.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def ad_params
          params.require(:ad).permit(
            :name, :zone, :size, :image_url, :link_url, :alt, :html,
            :is_active, :starts_at, :ends_at, :weight
          )
        end

        def serialize(a)
          {
            id: a.id, name: a.name, zone: a.zone, size: a.size,
            image_url: a.image_url, link_url: a.link_url, alt: a.alt, html: a.html,
            is_active: a.is_active, starts_at: a.starts_at, ends_at: a.ends_at,
            weight: a.weight, impressions: a.impressions, clicks: a.clicks
          }
        end
      end
    end
  end
end
