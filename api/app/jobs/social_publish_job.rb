# frozen_string_literal: true

require "net/http"
require "uri"
require "json"

# Pushes a newly-published article to a social webhook (Zapier / Make /
# Ayrshare), which fans it out to the connected social accounts. Fires once
# per article; no-op unless SOCIAL_WEBHOOK_URL is set.
class SocialPublishJob < ApplicationJob
  queue_as :default

  def perform(article_id)
    article = Article.includes(:primary_category).find_by(id: article_id)
    return unless article&.status_published?
    return if article.social_posted_at.present?

    url = ENV["SOCIAL_WEBHOOK_URL"].to_s
    return if url.blank?

    payload = {
      title: article.title,
      url: "https://harnesslink.com/#{article.slug}/",
      excerpt: article.excerpt.to_s,
      category: article.primary_category&.name,
      image: article.featured_media&.responsive&.dig(:src),
      published_at: article.published_at&.iso8601
    }

    deliver(url, payload)
    article.update_column(:social_posted_at, Time.current)
  end

  private

  def deliver(url, payload)
    uri = URI.parse(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = 10
    http.read_timeout = 15
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req.body = payload.to_json
    http.request(req)
  rescue StandardError => e
    Rails.logger.warn("[social] webhook failed for #{payload[:url]}: #{e.message}")
    raise # let ActiveJob retry
  end
end
