# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Staff sign-in for the editorial portal. Returns a session token the
      # Next.js admin keeps in an httpOnly cookie and replays as a Bearer token.
      class SessionsController < BaseController
        skip_before_action :authenticate_staff!, only: :create
        rate_limit to: 10, within: 3.minutes, only: :create,
                   with: -> { render json: { error: "Too many attempts. Try again in a few minutes." }, status: :too_many_requests }

        # POST /api/v1/admin/session  { email, password }
        def create
          user = User.staff.find_by(email: params[:email].to_s.strip.downcase)

          if user&.active? && user.password_digest.present? && user.authenticate(params[:password].to_s)
            user.update_column(:last_sign_in_at, Time.current)
            render json: { token: user.generate_token_for(:staff_session), user: UsersController.serialize(user) }
          else
            # Same answer for unknown email, wrong password and deactivated account.
            render json: { error: "That email and password don't match a staff account." }, status: :unauthorized
          end
        end

        # GET /api/v1/admin/session — who am I?
        def show
          render json: { user: UsersController.serialize(current_user) }
        end
      end
    end
  end
end
