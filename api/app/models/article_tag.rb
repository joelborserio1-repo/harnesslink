# frozen_string_literal: true

class ArticleTag < ApplicationRecord
  belongs_to :article
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :article_id }
end
