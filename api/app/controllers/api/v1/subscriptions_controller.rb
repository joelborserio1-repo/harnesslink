# frozen_string_literal: true

module Api
  module V1
    # Free registration-wall signup: captures an email as a reader account.
    # Passwordless — the reader is on the list and past the wall; a magic-link
    # login can be added later. Idempotent (re-subscribing is a no-op success).
    class SubscriptionsController < ApplicationController
      def create
        email = params[:email].to_s.strip.downcase
        unless email.match?(URI::MailTo::EMAIL_REGEXP)
          return render json: { error: "Please enter a valid email address." }, status: :unprocessable_entity
        end

        user = User.find_by("lower(email) = ?", email)
        unless user
          user = User.create!(email: email, role: :reader)
        end
        render json: { ok: true, email: user.email }
      end
    end
  end
end
