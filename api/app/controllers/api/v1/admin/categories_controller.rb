# frozen_string_literal: true

module Api
  module V1
    module Admin
      class CategoriesController < BaseController
        # GET /api/v1/admin/categories
        def index
          categories = Category.ordered
          render json: {
            categories: categories.map { |c| { id: c.id, name: c.name, slug: c.slug, kind: c.kind } }
          }
        end
      end
    end
  end
end
