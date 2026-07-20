# frozen_string_literal: true

require "base64"
require "openssl"

module Media
  # Builds imgproxy URLs to resize/re-encode images on the fly (WebP/AVIF,
  # responsive widths). imgproxy fetches the source (the original WordPress
  # upload during transition, object storage later) so we get modern, cached
  # images without migrating every file first.
  #
  # Config (all optional):
  #   IMGPROXY_URL   public base, e.g. https://img.harnesslink.com  (unset -> originals)
  #   IMGPROXY_KEY   hex-encoded signing key   (unset -> "insecure" signature)
  #   IMGPROXY_SALT  hex-encoded signing salt
  module Imgproxy
    module_function

    def configured?
      ENV["IMGPROXY_URL"].present?
    end

    # Returns an imgproxy URL, or the original source when imgproxy isn't
    # configured (so images always work).
    def url(source, width:, height: 0, format: "webp", resize: "fit")
      return source if source.blank? || !configured?

      options = "rs:#{resize}:#{width.to_i}:#{height.to_i}/f:#{format}"
      encoded = Base64.urlsafe_encode64(source, padding: false)
      path = "/#{options}/#{encoded}"
      "#{ENV['IMGPROXY_URL'].chomp('/')}/#{sign(path)}#{path}"
    end

    def sign(path)
      key = ENV["IMGPROXY_KEY"]
      salt = ENV["IMGPROXY_SALT"]
      return "insecure" if key.blank? || salt.blank?

      digest = OpenSSL::HMAC.digest(
        "sha256", [key].pack("H*"), [salt].pack("H*") + path
      )
      Base64.urlsafe_encode64(digest, padding: false)
    end
  end
end
