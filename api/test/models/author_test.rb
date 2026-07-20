# frozen_string_literal: true

require "test_helper"

class AuthorTest < ActiveSupport::TestCase
  test "fixtures are valid" do
    assert authors(:adam).valid?
    assert authors(:bruce).valid?
  end

  test "requires name and unique slug" do
    a = Author.new(slug: authors(:adam).slug)
    assert_not a.valid?
    assert_includes a.errors[:name], "can't be blank"
    assert_includes a.errors[:slug], "has already been taken"
  end

  test "merged author reports its canonical record" do
    assert_equal authors(:bruce), authors(:bruce_dup).canonical
    assert_equal authors(:bruce), authors(:bruce).canonical
  end

  test "canonical scope excludes merged duplicates" do
    assert_includes Author.canonical, authors(:bruce)
    assert_not_includes Author.canonical, authors(:bruce_dup)
  end

  test "aliases lists collapsed duplicates" do
    assert_includes authors(:bruce).aliases, authors(:bruce_dup)
  end

  test "legacy_refs stores cross-system provenance as jsonb" do
    assert_equal 18, authors(:bruce).legacy_refs["wp_user_id"]
  end
end
