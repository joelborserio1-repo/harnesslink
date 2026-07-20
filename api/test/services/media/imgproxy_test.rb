# frozen_string_literal: true

require "test_helper"

module Media
  class ImgproxyTest < ActiveSupport::TestCase
    def with_env(vars)
      prev = vars.keys.index_with { |k| ENV[k] }
      vars.each { |k, v| ENV[k] = v }
      yield
    ensure
      prev.each { |k, v| ENV[k] = v }
    end

    test "returns the original source when imgproxy is not configured" do
      with_env("IMGPROXY_URL" => nil) do
        assert_equal "https://x.com/a.jpg", Imgproxy.url("https://x.com/a.jpg", width: 800)
      end
    end

    test "builds an insecure URL when no key/salt" do
      with_env("IMGPROXY_URL" => "https://img.example.com", "IMGPROXY_KEY" => nil, "IMGPROXY_SALT" => nil) do
        url = Imgproxy.url("https://x.com/a.jpg", width: 640, format: "webp")
        assert url.start_with?("https://img.example.com/insecure/rs:fit:640:0/f:webp/")
      end
    end

    test "signs the URL when key and salt are present" do
      with_env("IMGPROXY_URL" => "https://img.example.com",
               "IMGPROXY_KEY" => "aabbcc", "IMGPROXY_SALT" => "ddeeff") do
        url = Imgproxy.url("https://x.com/a.jpg", width: 640)
        assert_not_includes url, "/insecure/"
        assert_match %r{\Ahttps://img\.example\.com/[A-Za-z0-9_-]+/rs:fit:640:0/}, url
      end
    end

    test "blank source returns blank" do
      with_env("IMGPROXY_URL" => "https://img.example.com") do
        assert_equal "", Imgproxy.url("", width: 640)
      end
    end
  end
end
