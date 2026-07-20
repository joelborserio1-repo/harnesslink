# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Editorial admin for the directory. HTTP Basic gated (BaseController).
      class DirectoryListingsController < BaseController
        # GET /api/v1/admin/directory_listings?type=&q=&page=
        def index
          page     = [params.fetch(:page, 1).to_i, 1].max
          per_page = [[params.fetch(:per_page, 50).to_i, 1].max, 200].min

          scope = DirectoryListing.order(:directory_type, :name)
          scope = scope.of_type(params[:type]) if params[:type].present?
          if params[:q].present?
            like = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q])}%"
            scope = scope.where("name ILIKE ? OR stud_name ILIKE ?", like, like)
          end

          render json: {
            listings: scope.offset((page - 1) * per_page).limit(per_page).map { |l| serialize(l) },
            types: Directory::TypeRegistry.all.map { |t| { key: t[:key], plural: t[:plural] } },
            page: page, per_page: per_page, total: scope.count
          }
        end

        # GET /api/v1/admin/directory_listings/:id
        def show
          render json: { listing: serialize(find_listing, full: true) }
        end

        # POST /api/v1/admin/directory_listings
        def create
          listing = DirectoryListing.new(listing_params)
          save_and_render(listing, :created)
        end

        # PATCH /api/v1/admin/directory_listings/:id
        def update
          listing = find_listing
          listing.assign_attributes(listing_params)
          save_and_render(listing, :ok)
        end

        # DELETE /api/v1/admin/directory_listings/:id
        def destroy
          find_listing.destroy!
          head :no_content
        end

        # POST /api/v1/admin/directory_listings/import  (multipart: file, type)
        def import
          file = params[:file]
          return render json: { errors: ["No CSV file uploaded."] }, status: :unprocessable_entity unless file

          file.rewind if file.respond_to?(:rewind)
          csv = (file.respond_to?(:read) ? file.read : file.to_s).to_s.force_encoding("UTF-8")
          result = Directory::CsvImporter.new(csv, directory_type: params[:type]).call
          render json: {
            created: result.created, updated: result.updated,
            skipped: result.skipped, errors: result.errors
          }
        end

        private

        def find_listing
          DirectoryListing.find(params[:id])
        end

        def save_and_render(listing, ok_status)
          if listing.save
            render json: { listing: serialize(listing, full: true) }, status: ok_status
          else
            render json: { errors: listing.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def listing_params
          params.require(:listing).permit(
            :directory_type, :name, :slug, :stud_name, :country, :region, :stud_master,
            :suburb, :industry, :coverage, :gait, :status_note, :is_paying, :is_featured,
            :contact_phone, :contact_email, :contact_website, :stud_website, :contact_address,
            :profile_bio, :profile_image, :race_record, :service_fee, :progeny_note
          )
        end

        def serialize(l, full: false)
          base = {
            id: l.id, directory_type: l.directory_type, name: l.name, slug: l.slug,
            stud_name: l.stud_name, country: l.country, region: l.region,
            is_paying: l.is_paying, is_featured: l.is_featured, path: l.path
          }
          return base unless full

          base.merge(
            stud_master: l.stud_master, suburb: l.suburb, industry: l.industry,
            coverage: l.coverage, gait: l.gait, status_note: l.status_note,
            contact_phone: l.contact_phone, contact_email: l.contact_email,
            contact_website: l.contact_website, stud_website: l.stud_website,
            contact_address: l.contact_address, profile_bio: l.profile_bio,
            profile_image: l.profile_image, race_record: l.race_record,
            service_fee: l.service_fee, progeny_note: l.progeny_note
          )
        end
      end
    end
  end
end
