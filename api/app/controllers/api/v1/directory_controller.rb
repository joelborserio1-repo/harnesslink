# frozen_string_literal: true

module Api
  module V1
    # The HarnessLink Directory API. URL parity with the WordPress plugin:
    #   /directory/                       -> hub (all types + counts)
    #   /directory/{type}/                -> a type archive
    #   /directory/{type}/{id}/{slug}     -> a single listing profile
    class DirectoryController < ApplicationController
      # GET /api/v1/directory — hub: the types with listing counts.
      def index
        counts = DirectoryListing.group(:directory_type).count
        types = Directory::TypeRegistry.all.map do |t|
          { key: t[:key], url: t[:url], singular: t[:singular], plural: t[:plural],
            org_label: t[:org_label], count: counts[t[:key]].to_i }
        end
        render json: { types: types, total: counts.values.sum }
      end

      # GET /api/v1/directory/:type — listings of one type (by url slug).
      def type
        config = Directory::TypeRegistry.by_url(params[:type])
        return head :not_found unless config

        listings = DirectoryListing.of_type(config[:key])
                                   .in_country(params[:country])
                                   .featured_first
        render json: {
          type: { key: config[:key], url: config[:url], singular: config[:singular],
                  plural: config[:plural], org_label: config[:org_label], supports_gait: config[:supports_gait] },
          countries: DirectoryListing.of_type(config[:key]).where.not(country: "").distinct.pluck(:country).sort,
          listings: listings.map { |l| DirectoryListingSerializer.summary(l) }
        }
      end

      # GET /api/v1/directory/:type/:id — a single profile (id = public/legacy id).
      def show
        listing = DirectoryListing.includes(:progeny).find_by_public_id(params[:id])
        return head :not_found unless listing

        render json: { listing: DirectoryListingSerializer.full(listing) }
      end
    end
  end
end
