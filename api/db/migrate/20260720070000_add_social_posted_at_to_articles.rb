# frozen_string_literal: true

# Marks when an article was pushed to the social webhook, so it fires once
# (and never during a bulk import — the importer backfills this).
class AddSocialPostedAtToArticles < ActiveRecord::Migration[8.1]
  def change
    add_column :articles, :social_posted_at, :datetime
  end
end
