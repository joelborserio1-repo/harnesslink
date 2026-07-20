# frozen_string_literal: true

require "test_helper"

class CategoryTest < ActiveSupport::TestCase
  test "fixtures are valid" do
    assert categories(:usa).valid?
    assert categories(:top4).valid?
  end

  test "kind enum distinguishes geographic from editorial" do
    assert categories(:usa).kind_geographic?
    assert categories(:top4).kind_editorial?
  end

  test "slug is unique" do
    c = Category.new(name: "Dup", slug: categories(:usa).slug)
    assert_not c.valid?
    assert_includes c.errors[:slug], "has already been taken"
  end

  test "parent/child self-reference" do
    child = Category.create!(name: "New York", slug: "new-york", parent: categories(:usa))
    assert_equal categories(:usa), child.parent
    assert_includes categories(:usa).children, child
  end

  test "has many articles through join" do
    assert_includes categories(:usa).articles, articles(:lead)
  end

  test "geographic category links to a country nav entry" do
    assert_equal countries(:nz), categories(:new_zealand).country
  end
end
