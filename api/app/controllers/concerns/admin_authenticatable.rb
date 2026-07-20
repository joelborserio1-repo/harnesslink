# frozen_string_literal: true

# Dependency-free gate for the editorial admin: HTTP Basic auth against
# ADMIN_USER / ADMIN_PASSWORD env vars. This is a staging-grade gate; real
# per-user logins (User + has_secure_password) land when bcrypt is approved.
module AdminAuthenticatable
  extend ActiveSupport::Concern
  include ActionController::HttpAuthentication::Basic::ControllerMethods

  included do
    before_action :authenticate_admin!
  end

  private

  def authenticate_admin!
    expected_user = ENV["ADMIN_USER"].to_s
    expected_pass = ENV["ADMIN_PASSWORD"].to_s

    if expected_user.empty? || expected_pass.empty?
      return render json: { error: "Admin auth is not configured (set ADMIN_USER / ADMIN_PASSWORD)." },
                    status: :service_unavailable
    end

    authenticate_or_request_with_http_basic("Harnesslink Admin") do |user, pass|
      secure_eq(user, expected_user) && secure_eq(pass, expected_pass)
    end
  end

  def secure_eq(a, b)
    ActiveSupport::SecurityUtils.secure_compare(
      Digest::SHA256.hexdigest(a.to_s), Digest::SHA256.hexdigest(b.to_s)
    )
  end
end
