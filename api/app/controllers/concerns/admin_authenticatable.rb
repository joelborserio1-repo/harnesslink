# frozen_string_literal: true

# Gate for the editorial portal API: a per-person staff session token
# (`Authorization: Bearer …`, issued by Admin::SessionsController). Sets
# `current_user`; role checks are explicit per controller via require_editor! /
# require_admin!.
module AdminAuthenticatable
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_staff!
    attr_reader :current_user
  end

  private

  def authenticate_staff!
    token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
    user = token.present? ? User.find_by_token_for(:staff_session, token) : nil

    if user&.staff? && user.active?
      @current_user = user
    else
      render json: { error: "Sign in required." }, status: :unauthorized
    end
  end

  def require_editor!
    forbid! unless current_user.can_publish?
  end

  def require_admin!
    forbid! unless current_user.role_admin?
  end

  def forbid!
    render json: { error: "Your account does not have permission to do that." }, status: :forbidden
  end
end
