# frozen_string_literal: true

require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "fixtures are valid" do
    assert users(:editor).valid?
    assert users(:admin).valid?
  end

  test "role enum with prefix" do
    assert users(:editor).role_editor?
    assert users(:admin).role_admin?
  end

  test "email is required, formatted and unique" do
    assert_not User.new.valid?

    bad = User.new(email: "not-an-email")
    assert_not bad.valid?
    assert_includes bad.errors[:email], "is invalid"

    dup = User.new(email: users(:editor).email.upcase)
    assert_not dup.valid?
    assert_includes dup.errors[:email], "has already been taken"
  end
end
