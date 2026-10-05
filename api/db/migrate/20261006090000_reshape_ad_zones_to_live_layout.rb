# frozen_string_literal: true

# Ad placements now mirror harnesslink.com: a full-width banner, 800-wide
# in-column banners, and rails that stack three 300x250 boxes from one pool.
# Creatives carry their own pixel size so the page reserves exact space (no
# layout shift) whatever shape the advertiser supplies.
class ReshapeAdZonesToLiveLayout < ActiveRecord::Migration[8.1]
  RENAMES = {
    "home-top" => "home-billboard",
    "home-rail-2" => "home-rail", "home-rail-3" => "home-rail", "home-rail-mobile" => "home-rail",
    "article-rail-1" => "article-rail", "article-rail-2" => "article-rail",
    "article-rail-3" => "article-rail", "article-mobile" => "article-rail",
    "archive-rail-1" => "archive-rail", "archive-rail-2" => "archive-rail"
  }.freeze

  # Best-effort reverse (several old zones merged into one).
  REVERSE = {
    "home-billboard" => "home-top", "home-rail" => "home-rail-2",
    "article-rail" => "article-rail-1", "archive-rail" => "archive-rail-1",
    "article-bottom" => "article-mobile"
  }.freeze

  def up
    add_column :ads, :image_width, :integer
    add_column :ads, :image_height, :integer
    RENAMES.each { |from, to| execute(sql_update(from, to)) }
  end

  def down
    REVERSE.each { |from, to| execute(sql_update(from, to)) }
    remove_column :ads, :image_height
    remove_column :ads, :image_width
  end

  private

  def sql_update(from, to)
    "UPDATE ads SET zone = #{connection.quote(to)} WHERE zone = #{connection.quote(from)}"
  end
end
