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

  test "responsive returns src, srcset and intrinsic dimensions" do
    r = media_assets(:hero).responsive
    assert_equal media_assets(:hero).width, r[:width]
    assert_equal media_assets(:hero).height, r[:height]
    assert r[:srcset].include?("320w")
    assert r[:srcset].include?("1280w")
    assert r[:src].present?
  end

  test "responsive prefers storage_key, falls back to legacy_url" do
    assert_equal media_assets(:hero).storage_key, media_assets(:hero).source_url
    only_legacy = MediaAsset.new(legacy_url: "https://x.com/b.jpg")
    assert_equal "https://x.com/b.jpg", only_legacy.source_url
  end
end
