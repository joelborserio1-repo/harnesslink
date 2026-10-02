# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Staff account management (admins only). Accounts are deactivated, never
      # deleted, so a departed journalist's stories and revisions keep their owner.
      class UsersController < BaseController
        before_action :require_admin!

        def self.serialize(user)
          {
            id: user.id, email: user.email, name: user.name, role: user.role,
            active: user.active, author_id: user.author_id, author_name: user.author&.name,
            last_sign_in_at: user.last_sign_in_at&.iso8601
          }
        end

        # GET /api/v1/admin/users
        def index
          users = User.staff.includes(:author).order(:name, :email)
          render json: { users: users.map { |u| self.class.serialize(u) } }
        end

        # POST /api/v1/admin/users
        def create
          user = User.new(user_params)
          user.role = "contributor" if user.role_reader? # this screen only makes staff
          if user.password.blank?
            return render json: { errors: [ "Password can't be blank" ] }, status: :unprocessable_entity
          end
          save_and_render(user, :created)
        end

        # PATCH /api/v1/admin/users/:id
        def update
          user = User.staff.find(params[:id])
          attrs = user_params
          attrs = attrs.except(:password) if attrs[:password].blank?

          if user == current_user && (attrs[:role].to_s != user.role && attrs.key?(:role) || attrs[:active].to_s == "false")
            return render json: { errors: [ "You can't change your own role or deactivate yourself." ] },
                          status: :unprocessable_entity
          end

          user.assign_attributes(attrs)
          save_and_render(user, :ok)
        end

        private

        def user_params
          permitted = params.require(:user).permit(:email, :name, :role, :active, :author_id, :password)
          permitted[:role] = "contributor" unless %w[contributor editor admin].include?(permitted[:role].to_s) || !permitted.key?(:role)
          permitted[:author_id] = nil if permitted.key?(:author_id) && permitted[:author_id].blank?
          permitted
        end

        def save_and_render(user, status)
          if user.save
            render json: { user: self.class.serialize(user) }, status: status
          else
            render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
          end
        end
      end
    end
  end
end
