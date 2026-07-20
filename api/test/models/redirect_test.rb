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

  test "resolve matches an exact from_path" do
    assert_equal redirects(:old_slug), Redirect.resolve(redirects(:old_slug).from_path)
  end

  test "resolve tolerates a missing trailing slash" do
    without_slash = redirects(:old_slug).from_path.chomp("/")
    assert_equal redirects(:old_slug), Redirect.resolve(without_slash)
  end

  test "resolve ignores query string and returns nil for unknown paths" do
    assert_equal redirects(:old_slug), Redirect.resolve("#{redirects(:old_slug).from_path}?utm=1")
    assert_nil Redirect.resolve("/nothing-here/")
    assert_nil Redirect.resolve("")
  end
end
