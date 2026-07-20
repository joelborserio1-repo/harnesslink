# frozen_string_literal: true

require "test_helper"

class ArticleSocialTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    @prev = ENV["SOCIAL_WEBHOOK_URL"]
    ENV["SOCIAL_WEBHOOK_URL"] = "https://hooks.example.com/x"
  end
  teardown { ENV["SOCIAL_WEBHOOK_URL"] = @prev }

  test "publishing a new article enqueues the social job once" do
    assert_enqueued_with(job: SocialPublishJob) do
      Article.create!(slug: "social-one", title: "Social One", status: :published,
                      published_at: Time.current, body_format: :legacy_html, body_html: "<p>x</p>")
    end
  end

  test "a draft does not enqueue, and imported articles (social_posted_at set) stay silent" do
    assert_no_enqueued_jobs only: SocialPublishJob do
      Article.create!(slug: "draft-one", title: "Draft", status: :draft,
                      body_format: :legacy_html, body_html: "<p>x</p>")
      Article.create!(slug: "imported-one", title: "Imported", status: :published,
                      published_at: Time.current, social_posted_at: Time.current,
                      body_format: :legacy_html, body_html: "<p>x</p>")
    end
  end

  test "no webhook configured means no job" do
    ENV["SOCIAL_WEBHOOK_URL"] = ""
    assert_no_enqueued_jobs only: SocialPublishJob do
      Article.create!(slug: "social-two", title: "Social Two", status: :published,
                      published_at: Time.current, body_format: :legacy_html, body_html: "<p>x</p>")
    end
  end
end
