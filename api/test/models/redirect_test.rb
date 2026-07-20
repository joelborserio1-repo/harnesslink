# frozen_string_literal: true

require "test_helper"

class RedirectTest < ActiveSupport::TestCase
  test "fixture is valid" do
    assert redirects(:old_slug).valid?
  end

  test "from_path is required and unique" do
    r = Redirect.new(to_path: "/x/")
    assert_not r.valid?
    assert_includes r.errors[:from_path], "can't be blank"

    dup = Redirect.new(from_path: redirects(:old_slug).from_path, to_path: "/y/")
    assert_not dup.valid?
    assert_includes dup.errors[:from_path], "has already been taken"
  end

  test "status_code must be a real redirect code" do
    r = Redirect.new(from_path: "/a/", to_path: "/b/", status_code: 200)
    assert_not r.valid?
  end

  test "record_hit! increments counter and stamps time" do
    r = redirects(:old_slug)
    assert_difference -> { r.reload.hit_count }, 1 do
      r.record_hit!
    end
    assert_not_nil r.reload.last_hit_at
  end
end
