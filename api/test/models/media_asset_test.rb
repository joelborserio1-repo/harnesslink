# frozen_string_literal: true

require "test_helper"

class MediaAssetTest < ActiveSupport::TestCase
  test "fixtures are valid" do
    assert media_assets(:hero).valid?
    assert media_assets(:missing_file).valid?
  end

  test "status enum flags missing files" do
    assert media_assets(:hero).status_active?
    assert media_assets(:missing_file).status_missing?
  end

  test "dimensions_known? reflects width and height" do
    assert media_assets(:hero).dimensions_known?
    assert_not media_assets(:missing_file).dimensions_known?
  end

  test "legacy_wp_id is unique" do
    dup = MediaAsset.new(legacy_wp_id: media_assets(:hero).legacy_wp_id)
    assert_not dup.valid?
  end
end
