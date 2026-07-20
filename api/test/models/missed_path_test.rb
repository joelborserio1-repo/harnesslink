# frozen_string_literal: true

require "test_helper"

class MissedPathTest < ActiveSupport::TestCase
  test "record! creates a row and increments on repeat" do
    assert_difference -> { MissedPath.count }, 1 do
      MissedPath.record!("/gone/")
    end
    assert_no_difference -> { MissedPath.count } do
      MissedPath.record!("/gone/")
    end
    mp = MissedPath.find_by(path: "/gone/")
    assert_equal 2, mp.hits
    assert_not_nil mp.last_seen_at
  end

  test "record! ignores blank paths" do
    assert_nil MissedPath.record!("")
    assert_nil MissedPath.record!(nil)
  end
end
